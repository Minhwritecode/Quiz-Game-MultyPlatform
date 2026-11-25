import { supabase } from '@/core/network/supabase';
import { sanitizeOcrAndDocumentText } from '../domain/ocrCleaner';

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const FAST_LANG_CDN = 'https://tessdata.projectnaptha.com/4.0.0_fast';

export interface OcrOptions {
  language?: string;
  onProgress?: (progress: number, stage: string) => void;
}

interface TesseractWindow extends Window {
  Tesseract?: {
    recognize: (
      image: string | HTMLCanvasElement,
      langs: string,
      options?: {
        langPath?: string;
        logger?: (msg: { status?: string; progress?: number }) => void;
      }
    ) => Promise<{ data?: { text?: string } }>;
  };
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//i.test(src)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image.'));
    img.src = src;
  });
}

/**
 * Encodes an image URI into a crisp JPEG Base64 payload for direct Multimodal Gemini Vision analysis.
 */
export async function encodeImageUriToJpegBase64(imageUri: string): Promise<string> {
  if (typeof document === 'undefined' || !imageUri) return '';
  try {
    const img = await loadImageElement(imageUri);
    const maxEdge = 1650;
    const w0 = img.naturalWidth || img.width || 900;
    const h0 = img.naturalHeight || img.height || 700;
    const scale = Math.min(1, maxEdge / Math.max(w0, h0));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w0 * scale));
    canvas.height = Math.max(1, Math.round(h0 * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const idx = dataUrl.indexOf(',');
    return idx >= 0 ? dataUrl.slice(idx + 1) : '';
  } catch {
    return '';
  }
}

/**
 * Preserves crisp typography on dense diagrams (up to 1950px; upscales tiny screenshots < 900px by 1.6x)
 * without harsh binarization that turns colored diagram boxes into garbage characters.
 */
async function preprocessImageToCanvas(
  imageUri: string
): Promise<{ canvas: HTMLCanvasElement; base64Jpeg: string } | null> {
  if (typeof document === 'undefined') return null;
  try {
    const img = await loadImageElement(imageUri);
    const w0 = img.naturalWidth || img.width || 900;
    const h0 = img.naturalHeight || img.height || 700;
    const longest = Math.max(w0, h0);
    const scale = longest < 900 ? 1.65 : Math.min(1, 1950 / longest);
    const width = Math.max(1, Math.round(w0 * scale));
    const height = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    const idx = dataUrl.indexOf(',');
    const base64Jpeg = idx >= 0 ? dataUrl.slice(idx + 1) : '';

    // Gentle luminance normalization for Tesseract without turning colored icons into © / ® artifacts
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
        const norm = gray > 215 ? 255 : gray < 48 ? 16 : Math.round((gray - 128) * 1.12 + 128);
        const clamped = Math.max(0, Math.min(255, norm));
        d[i] = clamped;
        d[i + 1] = clamped;
        d[i + 2] = clamped;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // Ignore CORS-tainted canvas pixel read
    }

    return { canvas, base64Jpeg };
  } catch {
    return null;
  }
}

async function recognizeViaGeminiVisionFast(base64Jpeg: string): Promise<string> {
  if (!supabase || !base64Jpeg) return '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14_000);
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return '';
    const result = await supabase.functions.invoke('papybot', {
      body: {
        messages: [
          {
            role: 'user',
            content:
              'Hãy đọc và trích xuất CHÍNH XÁC, SẠCH SẼ toàn bộ chữ, tiêu đề sơ đồ, công thức toán học trong hình ảnh này theo đúng ngôn ngữ gốc (Tiếng Việt / Tiếng Anh / Đa ngôn ngữ). Trình bày rõ ràng theo từng mục/dòng, tuyệt đối không thêm ký tự rác.',
          },
        ],
        context: '/create/scan',
        image: { mimeType: 'image/jpeg', data: base64Jpeg },
        stream: false,
      },
      signal: controller.signal,
    });
    if (!result.error && typeof result.data?.answer === 'string') {
      const cleaned = sanitizeOcrAndDocumentText(result.data.answer);
      if (cleaned.length >= 4 && !cleaned.includes('AI không phản hồi')) {
        return cleaned;
      }
    }
  } catch {
    // Fall back to cleaned local Tesseract engine
  } finally {
    clearTimeout(timeout);
  }
  return '';
}

function loadTesseractScript(): Promise<TesseractWindow['Tesseract'] | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve(null);
  const w = window as TesseractWindow;
  if (w.Tesseract) return Promise.resolve(w.Tesseract);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 10000);
    const done = (val: TesseractWindow['Tesseract'] | null) => {
      clearTimeout(timeout);
      resolve(val);
    };
    const existing = document.querySelector(`script[src="${TESSERACT_CDN}"]`);
    if (existing) {
      existing.addEventListener('load', () => done((window as TesseractWindow).Tesseract ?? null), { once: true });
      existing.addEventListener('error', () => done(null), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = TESSERACT_CDN;
    script.async = true;
    script.onload = () => done((window as TesseractWindow).Tesseract ?? null);
    script.onerror = () => done(null);
    document.head.appendChild(script);
  });
}

async function recognizeViaFastTesseract(
  source: HTMLCanvasElement | string,
  language: string,
  onProgress?: (progress: number, stage: string) => void
): Promise<string> {
  try {
    onProgress?.(0.18, 'Đang nạp bộ máy OCR độ nét cao...');
    const tesseract = await loadTesseractScript();
    if (!tesseract) return '';

    const ocrPromise = tesseract.recognize(source, language, {
      langPath: FAST_LANG_CDN,
      logger: (m) => {
        if (!onProgress) return;
        const p = typeof m.progress === 'number' ? m.progress : 0;
        const st = m.status || '';
        if (st.includes('loading language') || st.includes('downloading')) {
          onProgress(0.22 + p * 0.33, `Đang tải gói ngôn ngữ (${language}) ${Math.round(p * 100)}%...`);
        } else if (st.includes('recognizing text')) {
          onProgress(0.55 + p * 0.42, `Đang nhận diện & khử nhiễu ký tự ${Math.round(p * 100)}%...`);
        }
      },
    });

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 28_000));
    const res = await Promise.race([ocrPromise, timeoutPromise]);
    onProgress?.(1, 'Hoàn tất nhận diện & chuẩn hóa văn bản!');
    return sanitizeOcrAndDocumentText(res?.data?.text ?? '');
  } catch {
    return '';
  }
}

export async function recognizeLocalImage(imageUri: string, options?: OcrOptions): Promise<string> {
  if (!imageUri) return '';
  const lang = options?.language || 'vie+eng';
  options?.onProgress?.(0.08, 'Đang tối ưu độ nét hình ảnh & sơ đồ...');

  const prepared = await preprocessImageToCanvas(imageUri);
  if (prepared?.base64Jpeg) {
    options?.onProgress?.(0.14, 'Đang phân tích hình ảnh qua AI Vision...');
    const visionText = await recognizeViaGeminiVisionFast(prepared.base64Jpeg);
    if (visionText.length >= 4) {
      options?.onProgress?.(1, 'Nhận diện thành công qua AI Vision!');
      return visionText;
    }
  }

  return await recognizeViaFastTesseract(prepared?.canvas ?? imageUri, lang, options?.onProgress);
}
