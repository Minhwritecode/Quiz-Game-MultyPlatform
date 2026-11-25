import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import type { SocialMediaItem } from '../domain/models';

export interface StickerOrGifItem {
  id: string;
  kind: 'gif' | 'sticker';
  category: 'trending' | 'study' | 'celebrate' | 'funny' | 'love' | 'custom';
  title: string;
  shortcode: string;
  uri: string;
  attribution?: string;
}

function makeAnimatedStickerDataUri(bg1: string, bg2: string, emoji: string, caption: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg1}"/><stop offset="100%" stop-color="${bg2}"/></linearGradient></defs><rect x="10" y="10" width="240" height="240" rx="46" fill="url(#g)"/><circle cx="130" cy="108" r="70" fill="rgba(255,255,255,0.16)"><animate attributeName="r" values="64;74;64" dur="1.8s" repeatCount="indefinite"/></circle><text x="130" y="118" text-anchor="middle" dominant-baseline="middle" font-size="78">${emoji}<animateTransform attributeName="transform" type="scale" values="1;1.08;1" additive="sum" dur="1.4s" repeatCount="indefinite"/></text><rect x="28" y="186" width="204" height="42" rx="21" fill="rgba(15,23,42,0.58)"/><text x="130" y="212" text-anchor="middle" fill="#FFFFFF" font-family="system-ui,sans-serif" font-size="18" font-weight="900">${caption}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const BUILTIN_STICKER_PACKS: StickerOrGifItem[] = [
  { id: 'stk-aplus', kind: 'sticker', category: 'study', title: 'Đạt A+ Xuất Sắc', shortcode: ':aplus:', uri: makeAnimatedStickerDataUri('#4F46E5', '#7C3AED', '🏆', 'ĐẠT A+ RỒI!') },
  { id: 'stk-fire', kind: 'sticker', category: 'trending', title: 'Cháy Hết Mình', shortcode: ':fire_study:', uri: makeAnimatedStickerDataUri('#EA580C', '#E11D48', '🔥', 'QUÁ ĐỈNH LUÔN!') },
  { id: 'stk-brain', kind: 'sticker', category: 'study', title: 'Nổ Não Kiến Thức', shortcode: ':mindblown:', uri: makeAnimatedStickerDataUri('#0284C7', '#312E81', '🤯', 'HIỂU BẢN CHẤT!') },
  { id: 'stk-coffee', kind: 'sticker', category: 'study', title: 'Cày Đêm Ôn Thi', shortcode: ':allnighter:', uri: makeAnimatedStickerDataUri('#78350F', '#D97706', '☕', 'CÀY ĐÊM NÀO!') },
  { id: 'stk-clap', kind: 'sticker', category: 'celebrate', title: 'Vỗ Tay Tuyệt Vời', shortcode: ':bravo:', uri: makeAnimatedStickerDataUri('#059669', '#10B981', '👏', 'XUẤT SẮC QUÁ!') },
  { id: 'stk-heart', kind: 'sticker', category: 'love', title: 'Thả Tim Tri Thức', shortcode: ':scholar_love:', uri: makeAnimatedStickerDataUri('#BE185D', '#F43F5E', '💖', 'CẢM ƠN BẠN NHÉ!') },
  { id: 'stk-lol', kind: 'sticker', category: 'funny', title: 'Cười Xỉu Bug Code', shortcode: ':zero_bugs:', uri: makeAnimatedStickerDataUri('#0F766E', '#06B6D4', '😂', 'CHẠY KHÔNG BUG!') },
  { id: 'stk-team', kind: 'sticker', category: 'celebrate', title: 'Đồng Đội Gánh Team', shortcode: ':teamwork:', uri: makeAnimatedStickerDataUri('#4338CA', '#EC4899', '🤝', 'ĐỒNG ĐỘI ĐỈNH!') },
  { id: 'gif-rocket', kind: 'gif', category: 'trending', title: 'Tăng Tốc Lên Top', shortcode: ':rocket_go:', uri: makeAnimatedStickerDataUri('#1E1B4B', '#2563EB', '🚀', 'BỨT TỐC LÊN TOP') },
  { id: 'gif-party', kind: 'gif', category: 'celebrate', title: 'Ăn Mừng Chiến Thắng', shortcode: ':party_win:', uri: makeAnimatedStickerDataUri('#701A75', '#DB2777', '🎉', 'CHIẾN THẮNG!') },
  { id: 'gif-think', kind: 'gif', category: 'funny', title: 'Suy Ngẫm Sâu Sắc', shortcode: ':deep_think:', uri: makeAnimatedStickerDataUri('#1E293B', '#475569', '🧐', 'ĐỂ SUY NGHĨ ĐÃ...') },
  { id: 'gif-hug', kind: 'gif', category: 'love', title: 'Tiếp Năng Lượng', shortcode: ':cheer_up:', uri: makeAnimatedStickerDataUri('#9D174D', '#FB7185', '🤗', 'CỐ LÊN BẠN ƠI!') },
];

export const EMOJI_PICKER_CATEGORIES: Array<{
  id: string;
  label: string;
  emojis: string[];
}> = [
  { id: 'popular', label: 'Phổ biến', emojis: ['❤️', '🔥', '😂', '👏', '💡', '🎉', '👍', '🙌', '✨', '🥰', '😮', '😢'] },
  { id: 'study', label: 'Học thuật & Code', emojis: ['📚', '💻', '🧠', '🔬', '📐', '🧬', '🏛️', '🚀', '⚡', '🎯', '📝', '🏆'] },
  { id: 'faces', label: 'Biểu cảm', emojis: ['😊', '😎', '🤓', '🤔', '🥳', '🤩', '😅', '😭', '😤', '🫡', '🤝', '🙏'] },
];

/**
 * Lazy-loaded, paginated GIF & Sticker search.
 * Uses GIPHY API (`EXPO_PUBLIC_GIPHY_API_KEY`) when configured by admin/env with G-rated safety filter + attribution,
 * and seamlessly merges animated built-in packs without loading heavy libraries upfront!
 */
export async function searchGifsAndStickers(params: {
  query?: string;
  kind?: 'all' | 'gif' | 'sticker';
  category?: string;
  offset?: number;
  limit?: number;
}): Promise<{ items: StickerOrGifItem[]; hasMore: boolean; attribution?: string }> {
  const q = (params.query || '').trim().toLowerCase();
  const limit = params.limit ?? 12;
  const offset = params.offset ?? 0;

  const giphyKey = (process.env.EXPO_PUBLIC_GIPHY_API_KEY || '').trim();
  if (giphyKey && (params.kind === 'gif' || params.kind === 'all')) {
    try {
      const endpoint = q
        ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(giphyKey)}&q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}&rating=g&lang=vi`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(giphyKey)}&limit=${limit}&offset=${offset}&rating=g`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const json = (await res.json()) as { data?: any[]; pagination?: { total_count?: number } };
        const mapped: StickerOrGifItem[] = (json.data ?? [])
          .map((item: any) => ({
            id: `giphy-${item.id}`,
            kind: 'gif' as const,
            category: 'trending' as const,
            title: String(item.title || 'GIF'),
            shortcode: `:${item.slug || item.id}:`,
            uri: String(item.images?.fixed_height?.url || item.images?.original?.url || ''),
            attribution: 'Powered by GIPHY',
          }))
          .filter((x) => Boolean(x.uri));
        if (mapped.length > 0) {
          return {
            items: mapped,
            hasMore: (json.pagination?.total_count ?? 0) > offset + limit,
            attribution: 'Powered by GIPHY',
          };
        }
      }
    } catch {
      // Fall back to built-in curated animated stickers & GIFs
    }
  }

  const filtered = BUILTIN_STICKER_PACKS.filter((item) => {
    if (params.kind && params.kind !== 'all' && item.kind !== params.kind) return false;
    if (params.category && params.category !== 'all' && item.category !== params.category) return false;
    if (q && !`${item.title} ${item.shortcode} ${item.category}`.toLowerCase().includes(q)) return false;
    return true;
  });

  return {
    items: filtered.slice(offset, offset + limit),
    hasMore: offset + limit < filtered.length,
  };
}

/**
 * Compress & normalize image to crisp WebP/JPEG data URL on Web so multi-image carousels stay fast.
 */
async function compressWebImageFile(file: File, maxEdge = 1280, quality = 0.84): Promise<{
  uri: string;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      try {
        const ratio = Math.min(1, maxEdge / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const w = Math.max(1, Math.round((img.naturalWidth || 800) * ratio));
        const h = Math.max(1, Math.round((img.naturalHeight || 600) * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objUrl);
          resolve({ uri: objUrl, width: w, height: h });
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(objUrl);
        resolve({ uri: dataUrl, width: w, height: h });
      } catch (err) {
        URL.revokeObjectURL(objUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error('Không thể đọc tệp hình ảnh.'));
    };
    img.src = objUrl;
  });
}

/**
 * Pick multiple images for swipeable Threads/Facebook Carousel with live progress callback.
 */
export async function pickMultipleMediaImages(
  maxCount = 6,
  onProgress?: (pct: number) => void
): Promise<SocialMediaItem[]> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = async () => {
        const files = Array.from(input.files ?? []).slice(0, maxCount);
        if (files.length === 0) {
          resolve([]);
          return;
        }
        const items: SocialMediaItem[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i]!;
          onProgress?.(Math.round(((i + 0.5) / files.length) * 100));
          const compressed = await compressWebImageFile(f).catch(() => null);
          if (compressed) {
            items.push({
              id: `img-${Date.now()}-${i}`,
              kind: 'image',
              uri: compressed.uri,
              thumbnailUri: compressed.uri,
              width: compressed.width,
              height: compressed.height,
              altText: f.name.replace(/\.[^.]+$/, ''),
            });
          }
        }
        onProgress?.(100);
        resolve(items);
      };
      input.click();
    });
  }

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: maxCount,
    quality: 0.82,
  });
  if (res.canceled) return [];
  onProgress?.(100);
  return res.assets.map((a, idx) => ({
    id: `img-${Date.now()}-${idx}`,
    kind: 'image',
    uri: a.uri,
    thumbnailUri: a.uri,
    width: a.width,
    height: a.height,
  }));
}

/**
 * Video Cover / Thumbnail Editor Service (Section 5.3):
 * Captures a crisp JPEG thumbnail from ANY timestamp (`second`) of a video,
 * plus generates a multi-frame filmstrip so users can pick the exact cover frame
 * or crop to 9:16 (Story), 16:9 (Feed), or 1:1 (Grid) — NEVER leaving a black video box!
 */
export async function captureVideoFrameAtTime(
  videoUri: string,
  targetSecond = 0.1,
  cropAspect: '9:16' | '16:9' | '1:1' | '4:5' = '16:9'
): Promise<{ thumbnailUri: string; durationSec: number }> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return { thumbnailUri: videoUri, durationSec: 10 };
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    let settled = false;
    const finish = (thumb: string, dur: number) => {
      if (settled) return;
      settled = true;
      resolve({ thumbnailUri: thumb, durationSec: Math.max(1, Math.round(dur || 8)) });
    };

    const timeout = setTimeout(() => {
      finish(makeAnimatedStickerDataUri('#0F172A', '#4F46E5', '🎬', 'Video Preview'), 8);
    }, 5000);

    video.onloadedmetadata = () => {
      const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 8;
      video.currentTime = Math.min(Math.max(0.05, targetSecond), Math.max(0.05, dur - 0.1));
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const vw = video.videoWidth || 720;
        const vh = video.videoHeight || 1280;
        const targetRatio =
          cropAspect === '9:16'
            ? 9 / 16
            : cropAspect === '1:1'
            ? 1
            : cropAspect === '4:5'
            ? 4 / 5
            : 16 / 9;
        const srcRatio = vw / vh;
        let sx = 0;
        let sy = 0;
        let sw = vw;
        let sh = vh;
        if (srcRatio > targetRatio) {
          sw = Math.round(vh * targetRatio);
          sx = Math.round((vw - sw) / 2);
        } else {
          sh = Math.round(vw / targetRatio);
          sy = Math.round((vh - sh) / 2);
        }

        const outW = cropAspect === '9:16' ? 540 : 720;
        const outH = Math.round(outW / targetRatio);
        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
          const jpg = canvas.toDataURL('image/jpeg', 0.85);
          finish(jpg, video.duration || 8);
          return;
        }
      } catch {
        // Ignore canvas taint
      }
      finish(makeAnimatedStickerDataUri('#0F172A', '#4F46E5', '🎬', 'Video Preview'), video.duration || 8);
    };

    video.onerror = () => {
      clearTimeout(timeout);
      finish(makeAnimatedStickerDataUri('#0F172A', '#4F46E5', '🎬', 'Video Preview'), 8);
    };

    video.src = videoUri;
  });
}

export async function extractVideoCoverFilmstrip(
  videoUri: string,
  aspect: '9:16' | '16:9' | '1:1' | '4:5' = '16:9',
  sampleCount = 4
): Promise<{ frames: Array<{ second: number; uri: string }>; durationSec: number }> {
  const first = await captureVideoFrameAtTime(videoUri, 0.1, aspect);
  const dur = first.durationSec;
  const frames: Array<{ second: number; uri: string }> = [{ second: 0.1, uri: first.thumbnailUri }];
  if (Platform.OS === 'web' && dur > 1.5) {
    for (let i = 1; i < sampleCount; i++) {
      const sec = Number(((dur * i) / sampleCount).toFixed(1));
      const snap = await captureVideoFrameAtTime(videoUri, sec, aspect);
      frames.push({ second: sec, uri: snap.thumbnailUri });
    }
  }
  return { frames, durationSec: dur };
}

export async function pickVideoWithAutoCover(
  aspect: '9:16' | '16:9' | '1:1' | '4:5' = '16:9'
): Promise<SocialMediaItem | null> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/mp4,video/webm,video/quicktime,video/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const blobUrl = URL.createObjectURL(file);
        const snap = await captureVideoFrameAtTime(blobUrl, 0.15, aspect);
        resolve({
          id: `vid-${Date.now()}`,
          kind: 'video',
          uri: blobUrl,
          thumbnailUri: snap.thumbnailUri,
          coverTimestampSec: 0.15,
          aspectRatio: aspect,
          durationSec: snap.durationSec,
          fileName: file.name,
          mimeType: file.type || 'video/mp4',
        });
      };
      input.click();
    });
  }

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    quality: 0.8,
  });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  return {
    id: `vid-${Date.now()}`,
    kind: 'video',
    uri: asset.uri,
    thumbnailUri: asset.uri,
    coverTimestampSec: 0,
    aspectRatio: aspect,
    durationSec: asset.duration ? Math.max(1, Math.round(asset.duration / 1000)) : 10,
  };
}
