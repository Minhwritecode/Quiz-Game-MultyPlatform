import { Platform } from 'react-native';
import { supabase } from '@/core/network/supabase';
import { extractCompleteSentences } from '@/features/scan-ocr/domain/ocrCleaner';
import type {
  DailyKnowledgeArticle,
  GroupChatMessage,
  ScholarStory,
  ThreadPost,
} from '../domain/models';

export type CommunityRealtimeEvent =
  | { type: 'new-post'; post: ThreadPost }
  | { type: 'new-story'; story: ScholarStory }
  | { type: 'new-message'; message: GroupChatMessage }
  | { type: 'typing'; channelId: string; senderId: string; senderName: string };

let communityChannel: any = null;
const eventListeners = new Set<(ev: CommunityRealtimeEvent) => void>();

function ensureCommunityChannel() {
  if (!supabase) return null;
  if (communityChannel) return communityChannel;
  const ch = supabase.channel('papyrus:community-live', {
    config: { broadcast: { self: false } },
  });
  (ch as unknown as { on: (t: string, f: object, cb: (m: { payload?: CommunityRealtimeEvent }) => void) => void }).on(
    'broadcast',
    { event: 'community-ev' },
    (msg: { payload?: CommunityRealtimeEvent }) => {
      const payload = msg?.payload;
      if (!payload) return;
      eventListeners.forEach((fn) => {
        try {
          fn(payload);
        } catch {
          // Ignore
        }
      });
    }
  );
  ch.subscribe();
  communityChannel = ch;
  return ch;
}

export function subscribeCommunityRealtime(
  onEvent: (ev: CommunityRealtimeEvent) => void
): () => void {
  eventListeners.add(onEvent);
  ensureCommunityChannel();
  return () => {
    eventListeners.delete(onEvent);
  };
}

export function broadcastCommunityEvent(ev: CommunityRealtimeEvent): void {
  const ch = ensureCommunityChannel();
  if (!ch) return;
  void ch.send({
    type: 'broadcast',
    event: 'community-ev',
    payload: ev,
  });
}

const UNSAFE_CONTENT_RE =
  /\b(tình dục|khiêu dâm|sex|porn|prostitut|zoophilia|bestiality|erotic|hentai|xâm hại|cưỡng hiếp|18\+|nsfw|cờ bạc|sòng bạc|baccarat|casino|cá độ)\b/i;

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getSearchApiEndpoint(params: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/search?${params}`;
  }
  return `https://papyrus-lyart-five.vercel.app/api/search?${params}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEditorialCoverDataUri(source: string, category: string, title: string): string {
  const hay = `${source} ${category} ${title}`.toLowerCase();
  let c1 = '#1C3F94';
  let c2 = '#312E81';
  let accent = '#FBBF24';
  if (/(khoa học|vũ trụ|space|lượng tử|sinh|vật lý|openalex)/i.test(hay)) {
    c1 = '#065F46';
    c2 = '#1E3A8A';
    accent = '#34D399';
  } else if (/(google news|thời sự|tin mới|quốc tế)/i.test(hay)) {
    c1 = '#1E293B';
    c2 = '#1C3F94';
    accent = '#60A5FA';
  } else if (/(hacker news|kỹ thuật|code|dev|phần mềm)/i.test(hay)) {
    c1 = '#312E81';
    c2 = '#7C2D12';
    accent = '#F59E0B';
  }
  const cleanTitle = title.length > 78 ? `${title.slice(0, 76).trim()}…` : title;
  const line1 = escapeXml(cleanTitle.slice(0, 42));
  const line2 = escapeXml(cleanTitle.slice(42));
  const badge = escapeXml(`${source} · ${category}`.slice(0, 48));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="800" height="420" fill="url(#bg)"/><circle cx="690" cy="86" r="150" fill="rgba(255,255,255,0.06)"/><circle cx="110" cy="360" r="190" fill="rgba(255,255,255,0.05)"/><rect x="44" y="42" width="12" height="36" rx="6" fill="${accent}"/><text x="68" y="67" fill="#E2E8F0" font-family="system-ui,-apple-system,sans-serif" font-size="20" font-weight="800">${badge}</text><text x="44" y="246" fill="#FFFFFF" font-family="system-ui,-apple-system,sans-serif" font-size="31" font-weight="800">${line1}</text>${
    line2
      ? `<text x="44" y="292" fill="#F1F5F9" font-family="system-ui,-apple-system,sans-serif" font-size="31" font-weight="800">${line2}</text>`
      : ''
  }<text x="44" y="368" fill="${accent}" font-family="system-ui,-apple-system,sans-serif" font-size="18" font-weight="700">PAPYRUS DISCOVER · TRỰC TIẾP</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function ensureArticleThumbnail(it: DailyKnowledgeArticle): DailyKnowledgeArticle {
  const thumb = it.thumbnailUrl && it.thumbnailUrl.trim() ? it.thumbnailUrl.trim() : null;
  return {
    ...it,
    thumbnailUrl: thumb || buildEditorialCoverDataUri(it.source, it.category, it.title),
  };
}

/**
 * Live Real-Time Trending News & Academic Feed (synchronized with Search Engine).
 * Fetches real-time Google News (Science/AI/Tech/Education), Dev.to, and Hacker News via `/api/search?mode=trending`,
 * with direct CORS-safe live fallback when running offline/local dev.
 */
export async function fetchDailyUpdatedKnowledgeFeed(): Promise<DailyKnowledgeArticle[]> {
  // 1. Primary: Real-time Vercel Search Aggregator (Google News VN & Global + Dev.to + Hacker News)
  try {
    const res = await fetch(getSearchApiEndpoint('mode=trending'));
    if (res.ok) {
      const json = (await res.json()) as { items?: DailyKnowledgeArticle[] };
      if (Array.isArray(json.items) && json.items.length > 0) {
        return json.items
          .filter((it) => !UNSAFE_CONTENT_RE.test(`${it.title} ${it.summary}`))
          .map(ensureArticleThumbnail);
      }
    }
  } catch {
    // Fallback to direct live CORS sources below
  }

  // 2. Direct live CORS fallback (Dev.to + Spaceflight Science News + Wikipedia + Hacker News)
  const results: DailyKnowledgeArticle[] = [];

  const devToPromise = fetch('https://dev.to/api/articles?per_page=6&top=1')
    .then(async (res) => {
      if (!res.ok) return;
      const arr = (await res.json()) as Array<{
        id: number;
        title: string;
        description: string;
        url: string;
        cover_image?: string | null;
        social_image?: string | null;
        tag_list?: string[];
        readable_publish_date?: string;
      }>;
      if (!Array.isArray(arr)) return;
      arr.forEach((item) => {
        if (!item.title || UNSAFE_CONTENT_RE.test(item.title)) return;
        results.push(
          ensureArticleThumbnail({
            id: `devto-${item.id}`,
            source: 'Dev.to Tech',
            category: item.tag_list?.[0] ? `#${item.tag_list[0]}` : 'Kỹ thuật Phần mềm',
            title: item.title,
            summary: extractCompleteSentences(item.description || '', 2, item.title),
            url: item.url,
            thumbnailUrl: item.cover_image || item.social_image || null,
            publishedLabel: item.readable_publish_date || 'Vừa cập nhật',
          })
        );
      });
    })
    .catch(() => undefined);

  const spacePromise = fetch('https://api.spaceflightnewsapi.net/v4/articles/?limit=4')
    .then(async (res) => {
      if (!res.ok) return;
      const json = (await res.json()) as {
        results?: Array<{
          id: number;
          title?: string;
          summary?: string;
          url?: string;
          image_url?: string | null;
          news_site?: string;
          published_at?: string;
        }>;
      };
      for (const sp of json.results ?? []) {
        if (!sp.title || !sp.url || UNSAFE_CONTENT_RE.test(sp.title)) continue;
        results.push(
          ensureArticleThumbnail({
            id: `space-${sp.id}`,
            source: 'OpenAlex Khoa Học',
            category: `${sp.news_site || 'Space News'} · Khoa học & Vũ trụ`,
            title: sp.title,
            summary: extractCompleteSentences(sp.summary || '', 2, sp.title),
            url: sp.url,
            thumbnailUrl: sp.image_url || null,
            publishedLabel: sp.published_at ? sp.published_at.slice(0, 10) : 'Mới nhất hôm nay',
          })
        );
      }
    })
    .catch(() => undefined);

  const hnPromise = fetch(
    'https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=points>20&hitsPerPage=5'
  )
    .then(async (res) => {
      if (!res.ok) return;
      const data = (await res.json()) as {
        hits?: Array<{ objectID: string; title?: string; url?: string; author?: string; points?: number }>;
      };
      for (const h of data.hits ?? []) {
        if (!h.title || UNSAFE_CONTENT_RE.test(h.title)) continue;
        results.push(
          ensureArticleThumbnail({
            id: `hn-live-${h.objectID}`,
            source: 'Hacker News',
            category: `Xu hướng Công nghệ (${h.points ?? 0} pts)`,
            title: h.title,
            summary: `Bản tin công nghệ & khoa học máy tính cập nhật trực tiếp từ cộng đồng quốc tế (@${h.author || 'tech'}).`,
            url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
            publishedLabel: 'Mới nhất hôm nay',
          })
        );
      }
    })
    .catch(() => undefined);

  await Promise.all([devToPromise, spacePromise, hnPromise]);
  return results;
}

/**
 * True Real-Time Search Engine:
 * Queries `/api/search?q=...` (Google News VN & Global + Wikipedia Intro Extracts + Hacker News by Date + OpenAlex Papers)
 * plus direct client-side CORS queries so ANY topic ("Google Neon", breaking tech, academic concepts) returns fresh, exact matches!
 */
export async function searchAcademicKnowledgeLive(query: string): Promise<DailyKnowledgeArticle[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];
  const encoded = encodeURIComponent(clean);

  // 1. Primary: Live Server Aggregator (includes Google News RSS VN & Global!)
  try {
    const res = await fetch(getSearchApiEndpoint(`q=${encoded}`));
    if (res.ok) {
      const data = (await res.json()) as { items?: DailyKnowledgeArticle[] };
      if (Array.isArray(data.items) && data.items.length > 0) {
        return data.items
          .filter((it) => !UNSAFE_CONTENT_RE.test(`${it.title} ${it.summary}`))
          .map((it) =>
            ensureArticleThumbnail({
              ...it,
              summary: extractCompleteSentences(it.summary, 2, it.title),
            })
          );
      }
    }
  } catch {
    // Continue to direct browser multi-engine search
  }

  // 2. Direct Browser Multi-Engine Fallback (sorted by recency & strict keyword match)
  const tokens = clean
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  const found: DailyKnowledgeArticle[] = [];

  const hnByDate = fetch(`https://hn.algolia.com/api/v1/search_by_date?query=${encoded}&tags=story&hitsPerPage=6`)
    .then(async (res) => {
      if (!res.ok) return;
      const data = (await res.json()) as {
        hits?: Array<{ objectID: string; title?: string; url?: string; author?: string; points?: number; created_at?: string }>;
      };
      for (const h of data.hits ?? []) {
        if (!h.title || UNSAFE_CONTENT_RE.test(h.title)) continue;
        found.push({
          id: `hn-date-${h.objectID}`,
          source: 'Hacker News',
          category: `Tin mới nhất (${h.points ?? 0} pts)`,
          title: h.title,
          summary: `Tin tức & thảo luận mới nhất về "${clean}" được đăng bởi @${h.author || 'researcher'}.`,
          url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
          publishedLabel: h.created_at ? h.created_at.slice(0, 10) : 'Mới cập nhật',
        });
      }
    })
    .catch(() => undefined);

  const fetchWikiClean = (domain: 'vi.wikipedia.org' | 'en.wikipedia.org', label: 'Wikipedia VI' | 'Wikipedia EN') =>
    fetch(
      `https://${domain}/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=600&generator=search&gsrsearch=${encoded}&gsrlimit=4&format=json&origin=*`
    )
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as {
          query?: {
            pages?: Record<
              string,
              { pageid: number; index?: number; title?: string; extract?: string; thumbnail?: { source?: string } }
            >;
          };
        };
        const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
        for (const p of pages) {
          const title = stripHtmlTags(p.title || '');
          const extract = stripHtmlTags(p.extract || '');
          if (!title || UNSAFE_CONTENT_RE.test(title) || UNSAFE_CONTENT_RE.test(extract)) continue;
          const hay = `${title} ${extract.slice(0, 320)}`.toLowerCase();
          const matched = tokens.filter((t) => hay.includes(t)).length;
          if (tokens.length >= 2 && matched < Math.min(2, tokens.length)) continue;
          found.push({
            id: `${domain}-${p.pageid}`,
            source: label,
            category: label === 'Wikipedia VI' ? 'Bách khoa Toàn thư' : 'Global Encyclopedia',
            title,
            summary: extractCompleteSentences(extract, 2, title),
            url: `https://${domain}/?curid=${p.pageid}`,
            thumbnailUrl: p.thumbnail?.source ?? null,
            publishedLabel: 'Bách khoa Tri thức',
          });
        }
      })
      .catch(() => undefined);

  const openAlex = fetch(`https://api.openalex.org/works?search=${encoded}&per-page=4&sort=publication_year:desc`)
    .then(async (res) => {
      if (!res.ok) return;
      const json = (await res.json()) as {
        results?: Array<{
          id: string;
          title?: string;
          publication_year?: number;
          cited_by_count?: number;
          doi?: string;
        }>;
      };
      for (const w of json.results ?? []) {
        if (!w.title || UNSAFE_CONTENT_RE.test(w.title)) continue;
        found.push({
          id: `oa-${w.id.split('/').pop()}`,
          source: 'OpenAlex Khoa Học',
          category: `Bài báo Khoa học (${w.publication_year || 2026})`,
          title: w.title,
          summary: `Công trình nghiên cứu học thuật xuất bản năm ${w.publication_year || 2026} về "${clean}" (${w.cited_by_count ?? 0} trích dẫn).`,
          url: w.doi || w.id,
          publishedLabel: `Năm ${w.publication_year || 2026}`,
        });
      }
    })
    .catch(() => undefined);

  await Promise.all([
    hnByDate,
    fetchWikiClean('vi.wikipedia.org', 'Wikipedia VI'),
    fetchWikiClean('en.wikipedia.org', 'Wikipedia EN'),
    openAlex,
  ]);

  return found.map(ensureArticleThumbnail);
}
