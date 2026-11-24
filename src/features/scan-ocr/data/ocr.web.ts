import { supabase } from '@/core/network/supabase';

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const FAST_LANG_CDN = 'https://tessdata.projectnaptha.com/4.0.0_fast';

export interface OcrOptions {
  /** Tesseract language code(s), e.g. 'vie+eng', 'jpn+eng', 'kor+eng', 'chi_sim+eng', 'fra+deu+spa+eng' */
  language?: string;
  /** Optional progress callback (0..1, human-readable status) */
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
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image.'));
    img.src = src;
  });
}

/**
 * Downscales & contrast-enhances high-res phone photos on an offscreen canvas.
 * Makes OCR 5-10x faster and far more accurate on mobile Safari/Chrome.
 */
async function preprocessImageToCanvas(
  imageUri: string
): Promise<{ canvas: HTMLCanvasElement; base64Jpeg: string } | null> {
  if (typeof document === 'undefined') return null;
  try {
    const img = await loadImageElement(imageUri);
    const maxEdge = 1350;
    const w0 = img.naturalWidth || 900;
    const h0 = img.naturalHeight || 700;
    const scale = Math.min(1, maxEdge / Math.max(w0, h0));
    const width = Math.max(1, Math.round(w0 * scale));
    const height = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    // JPEG copy for multimodal AI Vision before contrast-grayscale pass
    const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
    const idx = dataUrl.indexOf(',');
    const base64Jpeg = idx >= 0 ? dataUrl.slice(idx + 1) : '';

    // Fast grayscale + gentle contrast stretch for crisp OCR edges
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      const contrast = 1.25;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
        const boosted = Math.max(0, Math.min(255, (gray - 128) * contrast + 132));
        d[i] = boosted;
        d[i + 1] = boosted;
        d[i + 2] = boosted;
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
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return '';
    const result = await supabase.functions.invoke('papybot', {
      body: {
        messages: [
          {
            role: 'user',
            content:
              'Transcribe ALL text visible in this image in its exact original language(s) (Vietnamese, English, Japanese, Korean, Chinese, French, Russian, Arabic, math formulas, etc.). Output ONLY the extracted text with no commentary.',
          },
        ],
        context: '/create/scan',
        image: { mimeType: 'image/jpeg', data: base64Jpeg },
        stream: false,
      },
      signal: controller.signal,
    });
    if (!result.error && typeof result.data?.answer === 'string') {
      const cleaned = result.data.answer.trim();
      if (cleaned.length >= 4 && !cleaned.includes('AI không phản hồi')) {
        return cleaned;
      }
    }
  } catch {
    // Fast-fail straight into local multilingual Tesseract_fast engine
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
    onProgress?.(0.15, 'Đang nạp bộ máy OCR đa ngôn ngữ...');
    const tesseract = await loadTesseractScript();
    if (!tesseract) return '';

    const ocrPromise = tesseract.recognize(source, language, {
      langPath: FAST_LANG_CDN,
      logger: (m) => {
        if (!onProgress) return;
        const p = typeof m.progress === 'number' ? m.progress : 0;
        const st = m.status || '';
        if (st.includes('loading language') || st.includes('downloading')) {
          onProgress(0.2 + p * 0.35, `Đang tải gói chữ (${language}) ${Math.round(p * 100)}%...`);
        } else if (st.includes('recognizing text')) {
          onProgress(0.55 + p * 0.42, `Đang nhận diện ký tự ${Math.round(p * 100)}%...`);
        }
      },
    });

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 28_000));
    const res = await Promise.race([ocrPromise, timeoutPromise]);
    onProgress?.(1, 'Hoàn tất nhận diện!');
    return (res?.data?.text ?? '').replace(/\s+\n/g, '\n').trim();
  } catch {
    return '';
  }
}

/**
 * Fast Multilingual Web OCR Adapter:
 * 1) Downscales & contrast-enhances image on canvas (5-10x faster on iPhone/Android photos).
 * 2) Probes Gemini Vision (4s fast-fail) for any language / handwriting when cloud AI is active.
 * 3) Runs fast `tessdata_fast` Tesseract.js v5 with user-selected multilingual pack & live % progress.
 */
export async function recognizeLocalImage(imageUri: string, options?: OcrOptions): Promise<string> {
  if (!imageUri) return '';
  const lang = options?.language || 'vie+eng';
  options?.onProgress?.(0.08, 'Đang tối ưu độ nét hình ảnh...');

  const prepared = await preprocessImageToCanvas(imageUri);
  if (prepared?.base64Jpeg) {
    options?.onProgress?.(0.14, 'Đang thử AI Vision đa ngôn ngữ...');
    const visionText = await recognizeViaGeminiVisionFast(prepared.base64Jpeg);
    if (visionText.length >= 4) {
      options?.onProgress?.(1, 'Nhận diện thành công qua AI Vision!');
      return visionText;
    }
  }

  return await recognizeViaFastTesseract(prepared?.canvas ?? imageUri, lang, options?.onProgress);
}
