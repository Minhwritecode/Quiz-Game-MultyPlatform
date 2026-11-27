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

const CLIENT_TOPIC_PHOTOS: Record<string, readonly string[]> = {
  ai: [
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=800&q=80',
  ],
  electronics: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=800&q=80',
  ],
  mobility: [
    'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=800&q=80',
  ],
  university: [
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=800&q=80',
  ],
  science: [
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=800&q=80',
  ],
  software: [
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&w=800&q=80',
  ],
  general: [
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
  ],
};

function hashText(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

/**
 * Selects an authentic, topic-matched 800px editorial photograph whenever
 * an external feed item has no thumbnail or its publisher blocks hotlinking.
 */
export function pickEditorialPhotoFallback(
  id: string,
  title: string,
  category = '',
  query = ''
): string {
  const hay = `${query} ${title} ${category}`.toLowerCase();
  let pool = CLIENT_TOPIC_PHOTOS.general!;
  if (/(xe bay|evtol|drone|máy bay|ô tô|xe điện|vũ trụ|tên lửa|space|flying)/i.test(hay)) {
    pool = CLIENT_TOPIC_PHOTOS.mobility!;
  } else if (/(điện tử|bán dẫn|vi mạch|chip|phần cứng|iot|semiconductor|hardware)/i.test(hay)) {
    pool = CLIENT_TOPIC_PHOTOS.electronics!;
  } else if (/(ai|trí tuệ nhân tạo|gemini|openai|gpt|robot|machine learning|neon)/i.test(hay)) {
    pool = CLIENT_TOPIC_PHOTOS.ai!;
  } else if (/(sinh viên|đại học|trường|giáo dục|học bổng|thi|thủy lợi|bách khoa)/i.test(hay)) {
    pool = CLIENT_TOPIC_PHOTOS.university!;
  } else if (/(lượng tử|vật lý|hóa học|sinh học|y học|khoa học|openalex|physics)/i.test(hay)) {
    pool = CLIENT_TOPIC_PHOTOS.science!;
  } else if (/(lập trình|phần mềm|code|javascript|python|react|hacker news|dev\.to)/i.test(hay)) {
    pool = CLIENT_TOPIC_PHOTOS.software!;
  }
  return pool[hashText(`${id}::${title}`) % pool.length]!;
}

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function getSearchApiEndpoint(params: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/search?${params}`;
  }
  return `https://papyrus-lyart-five.vercel.app/api/search?${params}`;
}

function ensureArticleThumbnail(it: DailyKnowledgeArticle, query = ''): DailyKnowledgeArticle {
  const thumb =
    it.thumbnailUrl &&
    it.thumbnailUrl.trim() &&
    !it.thumbnailUrl.startsWith('data:image/svg+xml')
      ? it.thumbnailUrl.trim()
      : null;
  return {
    ...it,
    thumbnailUrl: thumb || pickEditorialPhotoFallback(it.id, it.title, it.category, query),
  };
}

/**
 * Live Real-Time Trending News & Academic Feed (synchronized with Search Engine).
 */
export async function fetchDailyUpdatedKnowledgeFeed(
  forceFresh = false
): Promise<DailyKnowledgeArticle[]> {
  try {
    const qs = forceFresh ? `mode=trending&fresh=1&_t=${Date.now()}` : 'mode=trending';
    const res = await fetch(getSearchApiEndpoint(qs));
    if (res.ok) {
      const json = (await res.json()) as { items?: DailyKnowledgeArticle[] };
      if (Array.isArray(json.items) && json.items.length > 0) {
        return json.items
          .filter((it) => !UNSAFE_CONTENT_RE.test(`${it.title} ${it.summary}`))
          .map((it) => ensureArticleThumbnail(it));
      }
    }
  } catch {
    // Fallback to direct live CORS sources below
  }

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
 * Queries `/api/search?q=...` (no-store live Google News VN & Global + Wikipedia + Commons Photos + Hacker News + OpenAlex)
 * with AbortSignal support so rapid typing never jitters or overwrites newer queries.
 */
export async function searchAcademicKnowledgeLive(
  query: string,
  signal?: AbortSignal
): Promise<DailyKnowledgeArticle[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];
  const encoded = encodeURIComponent(clean);

  try {
    const res = await fetch(getSearchApiEndpoint(`q=${encoded}&_t=${Date.now()}`), { signal });
    if (res.ok) {
      const data = (await res.json()) as { items?: DailyKnowledgeArticle[] };
      if (Array.isArray(data.items) && data.items.length > 0) {
        return data.items
          .filter((it) => !UNSAFE_CONTENT_RE.test(`${it.title} ${it.summary}`))
          .map((it) =>
            ensureArticleThumbnail(
              {
                ...it,
                summary: extractCompleteSentences(it.summary, 2, it.title),
              },
              clean
            )
          );
      }
    }
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      return [];
    }
  }

  if (signal?.aborted) return [];

  // Direct Browser Multi-Engine Fallback
  const tokensFolded = stripAccents(clean)
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  const found: DailyKnowledgeArticle[] = [];

  const fetchWikiClean = (
    domain: 'vi.wikipedia.org' | 'en.wikipedia.org',
    label: 'Wikipedia VI' | 'Wikipedia EN'
  ) =>
    fetch(
      `https://${domain}/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=800&generator=search&gsrsearch=${encoded}&gsrlimit=5&format=json&origin=*`,
      { signal }
    )
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as {
          query?: {
            pages?: Record<
              string,
              {
                pageid: number;
                index?: number;
                title?: string;
                extract?: string;
                thumbnail?: { source?: string };
              }
            >;
          };
        };
        const pages = Object.values(json.query?.pages ?? {}).sort(
          (a, b) => (a.index ?? 99) - (b.index ?? 99)
        );
        for (const p of pages) {
          const title = stripHtmlTags(p.title || '');
          const extract = stripHtmlTags(p.extract || '');
          if (!title || UNSAFE_CONTENT_RE.test(title) || UNSAFE_CONTENT_RE.test(extract)) continue;
          const hayFolded = stripAccents(`${title} ${extract.slice(0, 320)}`);
          const matched = tokensFolded.filter((t) => hayFolded.includes(t)).length;
          if (tokensFolded.length >= 2 && matched < Math.ceil(tokensFolded.length * 0.5)) continue;
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

  const hnByDate = fetch(
    `https://hn.algolia.com/api/v1/search_by_date?query=${encoded}&tags=story&hitsPerPage=5`,
    { signal }
  )
    .then(async (res) => {
      if (!res.ok) return;
      const data = (await res.json()) as {
        hits?: Array<{
          objectID: string;
          title?: string;
          url?: string;
          author?: string;
          points?: number;
          created_at?: string;
        }>;
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

  const openAlex = fetch(
    `https://api.openalex.org/works?search=${encoded}&per-page=3&sort=publication_year:desc`,
    { signal }
  )
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
    fetchWikiClean('vi.wikipedia.org', 'Wikipedia VI'),
    fetchWikiClean('en.wikipedia.org', 'Wikipedia EN'),
    hnByDate,
    openAlex,
  ]);

  return found.map((it) => ensureArticleThumbnail(it, clean));
}
