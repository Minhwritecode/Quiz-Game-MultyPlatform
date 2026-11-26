import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export interface PickedStoryMedia {
  mediaType: 'image' | 'video';
  uri: string;
  thumbnailUri: string;
  durationSec?: number;
}

function readWebFileAsDataUrl(accept: string): Promise<{ dataUrl: string; file: File } | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    document.body.appendChild(input);

    let settled = false;
    const finish = (val: { dataUrl: string; file: File } | null) => {
      if (settled) return;
      settled = true;
      setTimeout(() => {
        try {
          document.body.removeChild(input);
        } catch {
          // Ignore
        }
      }, 300);
      resolve(val);
    };

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          finish({ dataUrl: reader.result, file });
        } else {
          finish(null);
        }
      };
      reader.onerror = () => finish(null);
      reader.readAsDataURL(file);
    };

    input.oncancel = () => finish(null);
    input.click();
  });
}

function cropAndCompressDataUrl(
  srcDataUrl: string,
  targetW: number,
  targetH: number,
  quality = 0.82
): Promise<string> {
  if (typeof document === 'undefined') return Promise.resolve(srcDataUrl);
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    // IMPORTANT: Never set crossOrigin='anonymous' on local data:/blob: URLs (breaks iOS Safari!)
    if (/^https?:\/\//i.test(srcDataUrl)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const sw = img.naturalWidth || img.width || targetW;
      const sh = img.naturalHeight || img.height || targetH;
      const scale = Math.max(targetW / sw, targetH / sh);
      const drawW = Math.round(sw * scale);
      const drawH = Math.round(sh * scale);
      const dx = Math.round((targetW - drawW) / 2);
      const dy = Math.round((targetH - drawH) / 2);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(srcDataUrl);
        return;
      }
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(img, dx, dy, drawW, drawH);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Không thể xử lý tệp ảnh đã chọn.'));
    img.src = srcDataUrl;
  });
}

/**
 * Extracts ONLY a crisp JPEG cover image from a video URL/DataURI on Web
 * while keeping 100% of the original video duration untouched!
 */
function captureFirstVideoFrameWeb(videoSrc: string): Promise<{ thumbnailUri: string; durationSec?: number }> {
  if (typeof document === 'undefined') {
    return Promise.resolve({ thumbnailUri: '' });
  }
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    if (/^https?:\/\//i.test(videoSrc)) {
      video.crossOrigin = 'anonymous';
    }

    let done = false;
    const finish = (thumb: string, dur?: number) => {
      if (done) return;
      done = true;
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {
        // Ignore
      }
      const validDur = dur && Number.isFinite(dur) && dur > 0 ? Math.ceil(dur) : undefined;
      resolve({ thumbnailUri: thumb, durationSec: validDur });
    };

    const timer = setTimeout(() => {
      const validDur =
        Number.isFinite(video.duration) && video.duration > 0 ? Math.ceil(video.duration) : undefined;
      finish('', validDur);
    }, 7000);

    const drawFrame = () => {
      clearTimeout(timer);
      const realDur =
        Number.isFinite(video.duration) && video.duration > 0 ? Math.ceil(video.duration) : undefined;
      try {
        const vw = video.videoWidth || 540;
        const vh = video.videoHeight || 960;
        const maxH = 720;
        const scale = Math.min(1, maxH / Math.max(vw, vh));
        const cw = Math.max(180, Math.round(vw * scale));
        const ch = Math.max(320, Math.round(vh * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, cw, ch);
          const thumb = canvas.toDataURL('image/jpeg', 0.84);
          finish(thumb, realDur);
          return;
        }
      } catch {
        // Fallback
      }
      finish('', realDur);
    };

    video.onloadeddata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0.25) {
        video.currentTime = 0.15;
      } else {
        drawFrame();
      }
    };
    video.onseeked = drawFrame;
    video.onerror = () => {
      clearTimeout(timer);
      finish('');
    };
    video.src = videoSrc;
  });
}

export async function pickCoverImageDataUrl(): Promise<string | null> {
  if (Platform.OS === 'web') {
    const picked = await readWebFileAsDataUrl('image/*');
    if (!picked) return null;
    return await cropAndCompressDataUrl(picked.dataUrl, 860, 290, 0.8);
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [16, 6],
    quality: 0.82,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
}

export async function pickAvatarImageDataUrl(): Promise<string | null> {
  if (Platform.OS === 'web') {
    const picked = await readWebFileAsDataUrl('image/*');
    if (!picked) return null;
    return await cropAndCompressDataUrl(picked.dataUrl, 260, 260, 0.84);
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.84,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
}

export async function pickStoryMedia(kind: 'image' | 'video'): Promise<PickedStoryMedia | null> {
  if (Platform.OS === 'web') {
    if (kind === 'video' && typeof document !== 'undefined') {
      // Pick raw Video File directly without truncating or re-encoding — only extract JPEG poster!
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        input.style.opacity = '0';
        document.body.appendChild(input);
        const cleanup = () => {
          setTimeout(() => {
            try {
              document.body.removeChild(input);
            } catch {
              // Ignore
            }
          }, 300);
        };
        input.onchange = async () => {
          const file = input.files?.[0];
          cleanup();
          if (!file) {
            resolve(null);
            return;
          }
          const objectUrl = URL.createObjectURL(file);
          const { thumbnailUri, durationSec } = await captureFirstVideoFrameWeb(objectUrl);
          // Persist dataURL for compact videos (<= 3.5MB), otherwise keep full-length objectURL
          if (file.size <= 3_500_000) {
            const reader = new FileReader();
            reader.onload = () => {
              const fullVideoDataUrl =
                typeof reader.result === 'string' ? reader.result : objectUrl;
              if (fullVideoDataUrl !== objectUrl) URL.revokeObjectURL(objectUrl);
              resolve({
                mediaType: 'video',
                uri: fullVideoDataUrl,
                thumbnailUri: thumbnailUri || '',
                durationSec,
              });
            };
            reader.onerror = () =>
              resolve({
                mediaType: 'video',
                uri: objectUrl,
                thumbnailUri: thumbnailUri || '',
                durationSec,
              });
            reader.readAsDataURL(file);
          } else {
            resolve({
              mediaType: 'video',
              uri: objectUrl,
              thumbnailUri: thumbnailUri || '',
              durationSec,
            });
          }
        };
        input.oncancel = () => {
          cleanup();
          resolve(null);
        };
        input.click();
      });
    }

    const picked = await readWebFileAsDataUrl('image/*');
    if (!picked) return null;
    const portraitUri = await cropAndCompressDataUrl(picked.dataUrl, 540, 960, 0.84);
    return { mediaType: 'image', uri: portraitUri, thumbnailUri: portraitUri };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kind === 'video' ? ['videos'] : ['images'],
    quality: 0.85,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const isVid = asset.type === 'video' || kind === 'video';
  return {
    mediaType: isVid ? 'video' : 'image',
    uri: asset.uri,
    thumbnailUri: asset.uri,
    durationSec: asset.duration ? Math.ceil(asset.duration / 1000) : undefined,
  };
}
