const UNSAFE_PATTERNS =
  /\b(tình dục|khiêu dâm|sex|porn|prostitut|zoophilia|bestiality|erotic|hentai|xâm hại|cưỡng hiếp|18\+|nsfw|cờ bạc|sòng bạc|baccarat|casino|cá độ)\b/i;

function decodeEntities(str = '') {
  return String(str)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function ensureCompleteSummary(raw, title = '', publisher = 'Báo chí') {
  let clean = decodeEntities(raw)
    .replace(/\s+-\s+[^-]{2,45}$/, '')
    .trim();
  if (publisher && clean.endsWith(publisher)) {
    clean = clean.slice(0, clean.length - publisher.length).trim();
  }
  if (!clean || clean.length < 22 || clean.toLowerCase() === title.toLowerCase()) {
    const cleanTitle = title.replace(/[.!?…]+$/, '');
    return `Điểm tin cập nhật mới nhất từ ${publisher}: "${cleanTitle}". Bạn có thể chuyển hóa ngay nội dung này thành bộ câu hỏi trắc nghiệm AI hoặc chia sẻ lên Story & Cộng đồng.`;
  }
  const sentences = clean
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 16);
  if (sentences.length > 0) {
    const joined = sentences.slice(0, 2).join(' ');
    return /[.!?…]$/.test(joined) ? joined : `${joined}.`;
  }
  return /[.!?…]$/.test(clean) ? clean : `${clean}.`;
}

function formatRelativeVi(pubDateStr) {
  if (!pubDateStr) return 'Vừa cập nhật';
  const ts = Date.parse(pubDateStr);
  if (Number.isNaN(ts)) return 'Mới cập nhật';
  const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} giờ trước`;
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function parseRssItems(xmlText, defaultCategory = 'Tin mới nhất', maxItems = 8) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null && items.length < maxItems) {
    const block = match[1] || '';
    const rawTitle = (block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
    const link = decodeEntities(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '');
    const desc = block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '';
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || '';
    const sourceTag = decodeEntities(block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || '');

    const cleanTitleFull = decodeEntities(rawTitle);
    const dashIdx = cleanTitleFull.lastIndexOf(' - ');
    const title = dashIdx > 12 ? cleanTitleFull.slice(0, dashIdx).trim() : cleanTitleFull;
    const publisher = sourceTag || (dashIdx > 12 ? cleanTitleFull.slice(dashIdx + 3).trim() : 'Google News');

    if (!title || !link || UNSAFE_PATTERNS.test(title) || UNSAFE_PATTERNS.test(desc)) continue;

    items.push({
      id: `gnews-${Buffer.from(link).toString('base64url').slice(0, 22)}`,
      source: 'Google News',
      category: `${publisher} · ${defaultCategory}`,
      title,
      summary: ensureCompleteSummary(desc, title, publisher),
      url: link,
      thumbnailUrl: null,
      publishedLabel: formatRelativeVi(pubDate),
      publishedAtMs: Date.parse(pubDate) || Date.now(),
    });
  }
  return items;
}

async function fetchWithTimeout(url, ms = 4800) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'PapyrusScholarSearch/2.7 (+https://papyrus-lyart-five.vercel.app)',
        Accept: 'application/json, application/rss+xml, text/xml, */*',
      },
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=90, stale-while-revalidate=180');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawQ = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
  const mode = typeof req.query?.mode === 'string' ? req.query.mode : rawQ ? 'search' : 'trending';

  try {
    if (mode === 'trending' || !rawQ) {
      const [vnTechRss, globalAiRss, hnLatest, devToTop] = await Promise.allSettled([
        fetchWithTimeout(
          'https://news.google.com/rss/search?q=' +
            encodeURIComponent('công nghệ OR trí tuệ nhân tạo OR khoa học OR giáo dục đại học when:2d') +
            '&hl=vi&gl=VN&ceid=VN:vi'
        ).then((r) => (r.ok ? r.text() : '')),
        fetchWithTimeout(
          'https://news.google.com/rss/search?q=' +
            encodeURIComponent('AI OR Science OR Software Engineering OR Space when:1d') +
            '&hl=en-US&gl=US&ceid=US:en'
        ).then((r) => (r.ok ? r.text() : '')),
        fetchWithTimeout('https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=points>25&hitsPerPage=5').then(
          (r) => (r.ok ? r.json() : null)
        ),
        fetchWithTimeout('https://dev.to/api/articles?per_page=4&top=1').then((r) => (r.ok ? r.json() : null)),
      ]);

      const merged = [];
      if (vnTechRss.status === 'fulfilled' && vnTechRss.value) {
        merged.push(...parseRssItems(vnTechRss.value, 'Tin Công nghệ & Khoa học VN', 6));
      }
      if (globalAiRss.status === 'fulfilled' && globalAiRss.value) {
        merged.push(...parseRssItems(globalAiRss.value, 'Global Tech & AI', 4));
      }
      if (devToTop.status === 'fulfilled' && Array.isArray(devToTop.value)) {
        for (const d of devToTop.value) {
          if (!d?.title || UNSAFE_PATTERNS.test(d.title)) continue;
          merged.push({
            id: `devto-${d.id}`,
            source: 'Dev.to Tech',
            category: d.tag_list?.[0] ? `#${d.tag_list[0]}` : 'Kỹ thuật Phần mềm',
            title: d.title,
            summary: ensureCompleteSummary(d.description || '', d.title),
            url: d.url,
            thumbnailUrl: d.cover_image || d.social_image || null,
            publishedLabel: formatRelativeVi(d.published_timestamp),
            publishedAtMs: Date.parse(d.published_timestamp) || Date.now() - 3600000,
          });
        }
      }
      if (hnLatest.status === 'fulfilled' && Array.isArray(hnLatest.value?.hits)) {
        for (const h of hnLatest.value.hits) {
          if (!h?.title || UNSAFE_PATTERNS.test(h.title)) continue;
          merged.push({
            id: `hn-${h.objectID}`,
            source: 'Hacker News',
            category: `Xu hướng Kỹ thuật (${h.points || 0} pts)`,
            title: h.title,
            summary: `Bài thảo luận công nghệ & nghiên cứu mới nhất từ cộng đồng kỹ sư quốc tế (@${h.author || 'tech'}).`,
            url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
            thumbnailUrl: null,
            publishedLabel: formatRelativeVi(h.created_at),
            publishedAtMs: Date.parse(h.created_at) || Date.now() - 7200000,
          });
        }
      }

      merged.sort((a, b) => (b.publishedAtMs || 0) - (a.publishedAtMs || 0));
      return res.status(200).json({ items: merged.slice(0, 14), updatedAt: new Date().toISOString() });
    }

    // LIVE REAL-TIME QUERY ENGINE FOR ANY USER KEYWORD (e.g. "Google Neon", "Gemini", "Lượng tử", etc.)
    const encoded = encodeURIComponent(rawQ);
    const tokens = rawQ
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 2);

    const [vnNews, enNews, viWiki, enWiki, hnByDate, openAlex] = await Promise.allSettled([
      fetchWithTimeout(`https://news.google.com/rss/search?q=${encoded}&hl=vi&gl=VN&ceid=VN:vi`).then((r) =>
        r.ok ? r.text() : ''
      ),
      fetchWithTimeout(`https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`).then((r) =>
        r.ok ? r.text() : ''
      ),
      fetchWithTimeout(
        `https://vi.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=600&generator=search&gsrsearch=${encoded}&gsrlimit=4&format=json`
      ).then((r) => (r.ok ? r.json() : null)),
      fetchWithTimeout(
        `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=600&generator=search&gsrsearch=${encoded}&gsrlimit=4&format=json`
      ).then((r) => (r.ok ? r.json() : null)),
      fetchWithTimeout(`https://hn.algolia.com/api/v1/search_by_date?query=${encoded}&tags=story&hitsPerPage=5`).then(
        (r) => (r.ok ? r.json() : null)
      ),
      fetchWithTimeout(`https://api.openalex.org/works?search=${encoded}&per-page=3&sort=publication_year:desc`).then(
        (r) => (r.ok ? r.json() : null)
      ),
    ]);

    const items = [];

    if (vnNews.status === 'fulfilled' && vnNews.value) {
      items.push(...parseRssItems(vnNews.value, 'Tin thời sự trực tiếp', 5));
    }
    if (enNews.status === 'fulfilled' && enNews.value) {
      items.push(...parseRssItems(enNews.value, 'Tin Quốc tế mới nhất', 5));
    }

    const collectWikiPages = (wikiJson, langLabel, domain) => {
      const pagesObj = wikiJson?.query?.pages;
      if (!pagesObj) return;
      const pages = Object.values(pagesObj).sort((a, b) => (a.index || 99) - (b.index || 99));
      for (const p of pages) {
        const title = String(p.title || '');
        const extract = String(p.extract || '');
        if (!title || UNSAFE_PATTERNS.test(title) || UNSAFE_PATTERNS.test(extract)) continue;
        const hay = `${title} ${extract.slice(0, 320)}`.toLowerCase();
        // Require strong relevance so multi-word queries like "Google Neon" never match random unrelated articles
        const matchedCount = tokens.filter((tk) => hay.includes(tk)).length;
        if (tokens.length >= 2 && matchedCount < Math.min(2, tokens.length)) continue;
        items.push({
          id: `${langLabel}-${p.pageid}`,
          source: langLabel === 'viwiki' ? 'Wikipedia VI' : 'Wikipedia EN',
          category: langLabel === 'viwiki' ? 'Bách khoa Toàn thư' : 'Global Encyclopedia',
          title,
          summary: ensureCompleteSummary(extract, title),
          url: `https://${domain}/?curid=${p.pageid}`,
          thumbnailUrl: p.thumbnail?.source || null,
          publishedLabel: 'Bách khoa Tri thức',
          publishedAtMs: Date.now() - 86400000,
        });
      }
    };

    if (viWiki.status === 'fulfilled' && viWiki.value) {
      collectWikiPages(viWiki.value, 'viwiki', 'vi.wikipedia.org');
    }
    if (enWiki.status === 'fulfilled' && enWiki.value) {
      collectWikiPages(enWiki.value, 'enwiki', 'en.wikipedia.org');
    }

    if (hnByDate.status === 'fulfilled' && Array.isArray(hnByDate.value?.hits)) {
      for (const h of hnByDate.value.hits) {
        if (!h?.title || UNSAFE_PATTERNS.test(h.title)) continue;
        items.push({
          id: `hn-${h.objectID}`,
          source: 'Hacker News',
          category: `Tin Công nghệ mới (${h.points || 0} pts)`,
          title: h.title,
          summary: `Cập nhật mới nhất về "${rawQ}" trên Hacker News bởi @${h.author || 'developer'}.`,
          url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
          thumbnailUrl: null,
          publishedLabel: formatRelativeVi(h.created_at),
          publishedAtMs: Date.parse(h.created_at) || Date.now() - 3600000,
        });
      }
    }

    if (openAlex.status === 'fulfilled' && Array.isArray(openAlex.value?.results)) {
      for (const w of openAlex.value.results) {
        if (!w?.title || UNSAFE_PATTERNS.test(w.title)) continue;
        const year = w.publication_year ? ` (${w.publication_year})` : '';
        const venue = w.primary_location?.source?.display_name || 'OpenAlex Research';
        items.push({
          id: `oa-${String(w.id || '').split('/').pop()}`,
          source: 'OpenAlex Khoa Học',
          category: `${venue}${year}`,
          title: w.title,
          summary: `Công trình nghiên cứu học thuật xuất bản${year} liên quan trực tiếp tới "${rawQ}" (${w.cited_by_count || 0} trích dẫn khoa học).`,
          url: w.doi || w.primary_location?.landing_page_url || w.id || 'https://openalex.org',
          thumbnailUrl: null,
          publishedLabel: w.publication_date || `Năm ${w.publication_year || 2026}`,
          publishedAtMs: Date.parse(w.publication_date) || Date.now() - 172800000,
        });
      }
    }

    // Deduplicate by normalized title
    const seenTitles = new Set();
    const deduped = [];
    for (const item of items) {
      const key = item.title.toLowerCase().slice(0, 60);
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      deduped.push(item);
    }

    return res.status(200).json({
      query: rawQ,
      items: deduped.slice(0, 16),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(200).json({
      query: rawQ,
      items: [],
      error: err instanceof Error ? err.message : 'Search error',
    });
  }
}
