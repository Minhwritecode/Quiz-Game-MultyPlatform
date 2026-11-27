const UNSAFE_PATTERNS =
  /\b(tình dục|khiêu dâm|sex|porn|prostitut|zoophilia|bestiality|erotic|hentai|xâm hại|cưỡng hiếp|18\+|nsfw|cờ bạc|sòng bạc|baccarat|casino|cá độ)\b/i;

const VIETNAMESE_QUERY_RE =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]|\b(xe|bay|điện|tử|mới|học|trí|tuệ|công|nghệ|việt|nam|thế|hệ|đồ|chơi|tin|tức|khoa|sinh|viên|trường|đại|lịch|sử|vật|lý|hóa|toán)\b/i;

/**
 * Curated high-resolution editorial photography bank (800px crisp 16:9 photos)
 * grouped by subject domain so every article without a publisher og:image gets
 * an authentic, visually relevant photograph instead of a text box.
 */
const TOPIC_PHOTO_BANK = {
  ai_robotics: [
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1555255707-c07966088b7b?auto=format&fit=crop&w=800&q=80',
  ],
  electronics_hardware: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=800&q=80',
  ],
  aviation_mobility: [
    'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
  ],
  university_education: [
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=800&q=80',
  ],
  science_lab: [
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=800&q=80',
  ],
  software_code: [
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&w=800&q=80',
  ],
  gadgets_design: [
    'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
  ],
};

function hashSeed(text = '') {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function selectTopicPhoto(id = '', title = '', category = '', query = '') {
  const hay = `${query} ${title} ${category}`.toLowerCase();
  let pool = TOPIC_PHOTO_BANK.gadgets_design;
  if (/(xe bay|evtol|drone|máy bay|hàng không|ô tô|xe điện|vũ trụ|tên lửa|space|aviation|flying)/i.test(hay)) {
    pool = TOPIC_PHOTO_BANK.aviation_mobility;
  } else if (/(điện tử|bán dẫn|vi mạch|chip|phần cứng|mạch|arduino|iot|semiconductor|hardware)/i.test(hay)) {
    pool = TOPIC_PHOTO_BANK.electronics_hardware;
  } else if (/(ai|trí tuệ nhân tạo|gemini|openai|gpt|llm|robot|machine learning|neural|neon)/i.test(hay)) {
    pool = TOPIC_PHOTO_BANK.ai_robotics;
  } else if (/(sinh viên|đại học|trường|giáo dục|học bổng|thi|olympic|thủy lợi|bách khoa)/i.test(hay)) {
    pool = TOPIC_PHOTO_BANK.university_education;
  } else if (/(lượng tử|vật lý|hóa học|sinh học|y học|gene|thí nghiệm|khoa học|openalex|physics)/i.test(hay)) {
    pool = TOPIC_PHOTO_BANK.science_lab;
  } else if (/(lập trình|phần mềm|code|javascript|python|react|linux|github|hacker news|dev\.to)/i.test(hay)) {
    pool = TOPIC_PHOTO_BANK.software_code;
  }
  return pool[hashSeed(`${id}::${title}`) % pool.length];
}

function stripVietnameseAccents(str = '') {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

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
    return `Cập nhật từ ${publisher}: "${cleanTitle}". Bạn có thể lưu làm tài liệu nguồn, tạo bộ đề trắc nghiệm AI hoặc chia sẻ lên Cộng đồng.`;
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

function isGenericPlaceholderImage(url = '') {
  return (
    !url ||
    !/^https?:\/\//i.test(url) ||
    url.includes('J6_coFbogxhRI9iM864NL_liGXvsQp2AupsKei7z0cNNfDvGUmWUy20nuUhkREQyrpY4bEeIBuc') ||
    url.includes('googleusercontent.com/proxy/') && url.endsWith('=s0-w300') ||
    url.endsWith('.svg')
  );
}

function extractRssThumbnail(block = '', desc = '') {
  const mediaContent = block.match(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i)?.[1];
  if (mediaContent && !isGenericPlaceholderImage(mediaContent)) return decodeEntities(mediaContent);
  const enclosure = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i)?.[1];
  if (enclosure && !isGenericPlaceholderImage(enclosure)) return decodeEntities(enclosure);
  const rawImg = (desc || block).match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  if (rawImg && !isGenericPlaceholderImage(rawImg)) {
    return decodeEntities(rawImg);
  }
  return null;
}

function parseRssItems(xmlText, defaultCategory = 'Tin mới nhất', maxItems = 10) {
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
      thumbnailUrl: extractRssThumbnail(block, desc),
      publishedLabel: formatRelativeVi(pubDate),
      publishedAtMs: Date.parse(pubDate) || Date.now(),
    });
  }
  return items;
}

async function fetchWithTimeout(url, ms = 3600) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PapyrusSearch/3.1; +https://papyrus-lyart-five.vercel.app)',
        Accept: 'application/json, application/rss+xml, text/xml, text/html, */*',
      },
    });
  } finally {
    clearTimeout(t);
  }
}

async function fetchCommonsPhotos(queryText, limit = 6) {
  if (!queryText) return [];
  try {
    const url =
      'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=' +
      encodeURIComponent(`${queryText} filetype:bitmap`) +
      `&gsrlimit=${limit}&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json`;
    const res = await fetchWithTimeout(url, 2200);
    if (!res.ok) return [];
    const json = await res.json();
    const pages = Object.values(json?.query?.pages || {});
    const urls = [];
    for (const p of pages) {
      const thumb = p?.imageinfo?.[0]?.thumburl || p?.imageinfo?.[0]?.url;
      if (thumb && !isGenericPlaceholderImage(thumb)) {
        urls.push(thumb);
      }
    }
    return urls;
  } catch {
    return [];
  }
}

async function resolveOgImage(url) {
  if (!url || url.includes('news.google.com/rss/')) return null;
  try {
    const res = await fetchWithTimeout(url, 1500);
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 48000);
    const og =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
    if (og && !isGenericPlaceholderImage(og)) {
      return decodeEntities(og);
    }
    return null;
  } catch {
    return null;
  }
}

async function enrichRealThumbnails(items, queryText = '') {
  const commonsPhotosPromise = queryText ? fetchCommonsPhotos(queryText, 8) : Promise.resolve([]);
  const ogTargets = items
    .filter((it) => !it.thumbnailUrl && it.url && !it.url.includes('news.google.com/rss/'))
    .slice(0, 5);

  const [commonsPhotos] = await Promise.all([
    commonsPhotosPromise,
    Promise.allSettled(
      ogTargets.map(async (it) => {
        const og = await resolveOgImage(it.url);
        if (og) it.thumbnailUrl = og;
      })
    ),
  ]);

  let commonsIdx = 0;
  return items.map((it) => {
    if (it.thumbnailUrl && !isGenericPlaceholderImage(it.thumbnailUrl)) {
      return it;
    }
    if (commonsPhotos.length > 0 && commonsIdx < commonsPhotos.length) {
      const picked = commonsPhotos[commonsIdx++];
      return { ...it, thumbnailUrl: picked };
    }
    return {
      ...it,
      thumbnailUrl: selectTopicPhoto(it.id, it.title, it.category, queryText),
    };
  });
}

function scoreItemRelevance(item, rawQuery, exactPhraseLower, exactPhraseFolded, tokensLower, tokensFolded) {
  const titleLower = (item.title || '').toLowerCase();
  const sumLower = (item.summary || '').toLowerCase();
  const titleFolded = stripVietnameseAccents(item.title || '');
  const sumFolded = stripVietnameseAccents(item.summary || '');

  let score = 0;
  if (titleLower.includes(exactPhraseLower)) score += 120;
  else if (titleFolded.includes(exactPhraseFolded)) score += 95;

  if (sumLower.includes(exactPhraseLower)) score += 55;
  else if (sumFolded.includes(exactPhraseFolded)) score += 40;

  let matchedExactTokens = 0;
  let matchedFoldedTokens = 0;
  for (let i = 0; i < tokensLower.length; i++) {
    const tl = tokensLower[i];
    const tf = tokensFolded[i];
    if (titleLower.includes(tl) || sumLower.includes(tl)) {
      matchedExactTokens += 1;
      if (titleLower.includes(tl)) score += 22;
      else score += 10;
    } else if (titleFolded.includes(tf) || sumFolded.includes(tf)) {
      matchedFoldedTokens += 1;
      if (titleFolded.includes(tf)) score += 14;
      else score += 6;
    }
  }

  const totalMatched = matchedExactTokens + matchedFoldedTokens;
  if (tokensLower.length > 0 && totalMatched === 0) {
    return -1;
  }
  if (tokensLower.length >= 2 && totalMatched < Math.ceil(tokensLower.length * 0.5)) {
    return -1;
  }

  const ageMs = Math.max(0, Date.now() - (item.publishedAtMs || 0));
  if (ageMs < 24 * 3600 * 1000) score += 24;
  else if (ageMs < 7 * 24 * 3600 * 1000) score += 12;

  return score;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawQ = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
  const mode = typeof req.query?.mode === 'string' ? req.query.mode : rawQ ? 'search' : 'trending';
  const forceFresh = req.query?.fresh === '1';

  if (mode === 'search' || rawQ || forceFresh) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
  } else {
    res.setHeader('Cache-Control', 's-maxage=45, stale-while-revalidate=90');
  }

  try {
    if (mode === 'trending' || !rawQ) {
      const [vnTechRss, globalAiRss, hnLatest, devToTop, spaceNews, wikiFeatured] = await Promise.allSettled([
        fetchWithTimeout(
          'https://news.google.com/rss/search?q=' +
            encodeURIComponent('công nghệ OR trí tuệ nhân tạo OR bán dẫn OR khoa học when:2d') +
            '&hl=vi&gl=VN&ceid=VN:vi'
        ).then((r) => (r.ok ? r.text() : '')),
        fetchWithTimeout(
          'https://news.google.com/rss/search?q=' +
            encodeURIComponent('Artificial Intelligence OR Robotics OR Quantum Computing when:1d') +
            '&hl=en-US&gl=US&ceid=US:en'
        ).then((r) => (r.ok ? r.text() : '')),
        fetchWithTimeout('https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=points>25&hitsPerPage=4').then(
          (r) => (r.ok ? r.json() : null)
        ),
        fetchWithTimeout('https://dev.to/api/articles?per_page=5&top=1').then((r) => (r.ok ? r.json() : null)),
        fetchWithTimeout('https://api.spaceflightnewsapi.net/v4/articles/?limit=4').then((r) => (r.ok ? r.json() : null)),
        fetchWithTimeout(
          'https://vi.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=800&generator=search&gsrsearch=' +
            encodeURIComponent('Trí tuệ nhân tạo Khoa học máy tính Vật lý lượng tử') +
            '&gsrlimit=4&format=json'
        ).then((r) => (r.ok ? r.json() : null)),
      ]);

      const merged = [];
      if (devToTop.status === 'fulfilled' && Array.isArray(devToTop.value)) {
        for (const d of devToTop.value) {
          if (!d?.title || UNSAFE_PATTERNS.test(d.title)) continue;
          merged.push({
            id: `devto-${d.id}`,
            source: 'Dev.to Tech',
            category: d.tag_list?.[0] ? `#${d.tag_list[0]}` : 'Kỹ thuật Phần mềm',
            title: d.title,
            summary: ensureCompleteSummary(d.description || '', d.title, 'Dev.to'),
            url: d.url,
            thumbnailUrl: d.cover_image || d.social_image || null,
            publishedLabel: formatRelativeVi(d.published_timestamp),
            publishedAtMs: Date.parse(d.published_timestamp) || Date.now() - 1800000,
          });
        }
      }
      if (spaceNews.status === 'fulfilled' && Array.isArray(spaceNews.value?.results)) {
        for (const sp of spaceNews.value.results) {
          if (!sp?.title || UNSAFE_PATTERNS.test(sp.title)) continue;
          merged.push({
            id: `space-${sp.id}`,
            source: 'OpenAlex Khoa Học',
            category: `${sp.news_site || 'Space News'} · Khoa học & Vũ trụ`,
            title: sp.title,
            summary: ensureCompleteSummary(sp.summary || '', sp.title, sp.news_site || 'Space News'),
            url: sp.url,
            thumbnailUrl: sp.image_url || null,
            publishedLabel: formatRelativeVi(sp.published_at),
            publishedAtMs: Date.parse(sp.published_at) || Date.now() - 2400000,
          });
        }
      }
      if (wikiFeatured.status === 'fulfilled' && wikiFeatured.value?.query?.pages) {
        for (const p of Object.values(wikiFeatured.value.query.pages)) {
          if (!p?.title || UNSAFE_PATTERNS.test(p.title)) continue;
          merged.push({
            id: `viwiki-trend-${p.pageid}`,
            source: 'Wikipedia VI',
            category: 'Chuyên đề Học thuật',
            title: String(p.title),
            summary: ensureCompleteSummary(String(p.extract || ''), String(p.title), 'Wikipedia'),
            url: `https://vi.wikipedia.org/?curid=${p.pageid}`,
            thumbnailUrl: p.thumbnail?.source || null,
            publishedLabel: 'Học liệu chọn lọc',
            publishedAtMs: Date.now() - 3200000,
          });
        }
      }
      if (vnTechRss.status === 'fulfilled' && vnTechRss.value) {
        merged.push(...parseRssItems(vnTechRss.value, 'Tin Công nghệ & Khoa học VN', 5));
      }
      if (globalAiRss.status === 'fulfilled' && globalAiRss.value) {
        merged.push(...parseRssItems(globalAiRss.value, 'Global Tech & AI', 3));
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
      const enrichedTrending = await enrichRealThumbnails(merged.slice(0, 14), '');
      return res.status(200).json({ items: enrichedTrending, updatedAt: new Date().toISOString() });
    }

    // LIVE REAL-TIME QUERY ENGINE FOR ANY VIETNAMESE OR INTERNATIONAL KEYWORD
    const encoded = encodeURIComponent(rawQ);
    const isVietnameseQuery = VIETNAMESE_QUERY_RE.test(rawQ);
    const exactPhraseLower = rawQ.toLowerCase();
    const exactPhraseFolded = stripVietnameseAccents(rawQ);
    const tokensLower = exactPhraseLower.split(/\s+/).filter((w) => w.length >= 2);
    const tokensFolded = tokensLower.map((w) => stripVietnameseAccents(w));

    const [vnNews, enNews, viWiki, enWiki, hnByDate, devToSearch, openAlex] = await Promise.allSettled([
      fetchWithTimeout(`https://news.google.com/rss/search?q=${encoded}&hl=vi&gl=VN&ceid=VN:vi`).then((r) =>
        r.ok ? r.text() : ''
      ),
      isVietnameseQuery
        ? Promise.resolve('')
        : fetchWithTimeout(`https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`).then((r) =>
            r.ok ? r.text() : ''
          ),
      fetchWithTimeout(
        `https://vi.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=800&generator=search&gsrsearch=${encoded}&gsrlimit=5&format=json`
      ).then((r) => (r.ok ? r.json() : null)),
      isVietnameseQuery
        ? Promise.resolve(null)
        : fetchWithTimeout(
            `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=800&generator=search&gsrsearch=${encoded}&gsrlimit=5&format=json`
          ).then((r) => (r.ok ? r.json() : null)),
      isVietnameseQuery
        ? Promise.resolve(null)
        : fetchWithTimeout(`https://hn.algolia.com/api/v1/search_by_date?query=${encoded}&tags=story&hitsPerPage=5`).then(
            (r) => (r.ok ? r.json() : null)
          ),
      isVietnameseQuery
        ? Promise.resolve(null)
        : fetchWithTimeout(`https://dev.to/api/articles?per_page=4&tag=${encodeURIComponent(tokensFolded[0] || '')}`).then(
            (r) => (r.ok ? r.json() : null)
          ),
      fetchWithTimeout(`https://api.openalex.org/works?search=${encoded}&per-page=3&sort=publication_year:desc`).then(
        (r) => (r.ok ? r.json() : null)
      ),
    ]);

    const candidates = [];

    if (vnNews.status === 'fulfilled' && vnNews.value) {
      candidates.push(...parseRssItems(vnNews.value, 'Tin thời sự trực tiếp', 10));
    }
    if (enNews.status === 'fulfilled' && enNews.value) {
      candidates.push(...parseRssItems(enNews.value, 'Tin Quốc tế mới nhất', 6));
    }

    const collectWikiPages = (wikiJson, langLabel, domain) => {
      const pagesObj = wikiJson?.query?.pages;
      if (!pagesObj) return;
      const pages = Object.values(pagesObj).sort((a, b) => (a.index || 99) - (b.index || 99));
      for (const p of pages) {
        const title = String(p.title || '');
        const extract = String(p.extract || '');
        if (!title || UNSAFE_PATTERNS.test(title) || UNSAFE_PATTERNS.test(extract)) continue;
        candidates.push({
          id: `${langLabel}-${p.pageid}`,
          source: langLabel === 'viwiki' ? 'Wikipedia VI' : 'Wikipedia EN',
          category: langLabel === 'viwiki' ? 'Bách khoa Toàn thư' : 'Global Encyclopedia',
          title,
          summary: ensureCompleteSummary(extract, title, 'Wikipedia'),
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

    if (devToSearch.status === 'fulfilled' && Array.isArray(devToSearch.value)) {
      for (const d of devToSearch.value) {
        if (!d?.title || UNSAFE_PATTERNS.test(d.title)) continue;
        candidates.push({
          id: `devto-q-${d.id}`,
          source: 'Dev.to Tech',
          category: d.tag_list?.[0] ? `#${d.tag_list[0]}` : 'Kỹ thuật Phần mềm',
          title: d.title,
          summary: ensureCompleteSummary(d.description || '', d.title, 'Dev.to'),
          url: d.url,
          thumbnailUrl: d.cover_image || d.social_image || null,
          publishedLabel: formatRelativeVi(d.published_timestamp),
          publishedAtMs: Date.parse(d.published_timestamp) || Date.now() - 3600000,
        });
      }
    }

    if (hnByDate.status === 'fulfilled' && Array.isArray(hnByDate.value?.hits)) {
      for (const h of hnByDate.value.hits) {
        if (!h?.title || UNSAFE_PATTERNS.test(h.title)) continue;
        candidates.push({
          id: `hn-${h.objectID}`,
          source: 'Hacker News',
          category: `Tin Công nghệ mới (${h.points || 0} pts)`,
          title: h.title,
          summary: `Thảo luận kỹ thuật trực tiếp liên quan tới "${rawQ}" trên Hacker News bởi @${h.author || 'developer'}.`,
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
        candidates.push({
          id: `oa-${String(w.id || '').split('/').pop()}`,
          source: 'OpenAlex Khoa Học',
          category: `${venue}${year}`,
          title: w.title,
          summary: `Công trình nghiên cứu học thuật xuất bản${year} về "${rawQ}" (${w.cited_by_count || 0} trích dẫn khoa học).`,
          url: w.doi || w.primary_location?.landing_page_url || w.id || 'https://openalex.org',
          thumbnailUrl: null,
          publishedLabel: w.publication_date || `Năm ${w.publication_year || 2026}`,
          publishedAtMs: Date.parse(w.publication_date) || Date.now() - 172800000,
        });
      }
    }

    // Score relevance + deduplicate by normalized title
    const scored = [];
    const seenTitles = new Set();
    for (const item of candidates) {
      const key = stripVietnameseAccents(item.title).slice(0, 64);
      if (seenTitles.has(key)) continue;
      const rel = scoreItemRelevance(
        item,
        rawQ,
        exactPhraseLower,
        exactPhraseFolded,
        tokensLower,
        tokensFolded
      );
      if (rel < 0 && candidates.length > 3) continue;
      seenTitles.add(key);
      scored.push({ item, rel });
    }

    scored.sort((a, b) => {
      if (b.rel !== a.rel) return b.rel - a.rel;
      return (b.item.publishedAtMs || 0) - (a.item.publishedAtMs || 0);
    });

    const topItems = await enrichRealThumbnails(
      scored.slice(0, 16).map((entry) => entry.item),
      rawQ
    );

    return res.status(200).json({
      query: rawQ,
      items: topItems,
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
