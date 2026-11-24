import { supabase } from '@/core/network/supabase';

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

interface TesseractWindow extends Window {
  Tesseract?: {
    recognize: (
      image: string | HTMLCanvasElement,
      langs: string
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

async function compressImageToJpegBase64(imageUri: string): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  try {
    const img = await loadImageElement(imageUri);
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round((img.naturalWidth || 800) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || 600) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const idx = dataUrl.indexOf(',');
    return idx >= 0 ? dataUrl.slice(idx + 1) : null;
  } catch {
    return null;
  }
}

async function recognizeViaGeminiVision(base64Jpeg: string): Promise<string> {
  if (!supabase) return '';
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return '';
    const result = await supabase.functions.invoke('papybot', {
      body: {
        messages: [
          {
            role: 'user',
            content:
              'Hãy đọc và trích xuất chính xác toàn bộ văn bản trong hình ảnh này (giữ nguyên tiếng Việt có dấu, công thức hoặc danh sách nếu có). Chỉ trả về nội dung văn bản đã trích xuất, không thêm lời bình.',
          },
        ],
        context: '/create/scan',
        image: { mimeType: 'image/jpeg', data: base64Jpeg },
        stream: false,
      },
    });
    if (!result.error && typeof result.data?.answer === 'string') {
      return result.data.answer.trim();
    }
  } catch {
    // Fall through to client-side Tesseract OCR
  }
  return '';
}

function loadTesseractScript(): Promise<TesseractWindow['Tesseract'] | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve(null);
  const w = window as TesseractWindow;
  if (w.Tesseract) return Promise.resolve(w.Tesseract);

  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${TESSERACT_CDN}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve((window as TesseractWindow).Tesseract ?? null), { once: true });
      existing.addEventListener('error', () => resolve(null), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = TESSERACT_CDN;
    script.async = true;
    script.onload = () => resolve((window as TesseractWindow).Tesseract ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

async function recognizeViaClientTesseract(imageUri: string): Promise<string> {
  try {
    const tesseract = await loadTesseractScript();
    if (!tesseract) return '';
    const res = await tesseract.recognize(imageUri, 'vie+eng');
    return (res?.data?.text ?? '').replace(/\s+\n/g, '\n').trim();
  } catch {
    return '';
  }
}

/**
 * Web OCR adapter:
 * 1) Uses Gemini Vision via Supabase Edge Function when signed in (high accuracy for Vietnamese & handwriting).
 * 2) Falls back seamlessly to client-side Tesseract.js WebAssembly OCR (vie+eng) for guests or offline resilience.
 */
export async function recognizeLocalImage(imageUri: string): Promise<string> {
  if (!imageUri) return '';

  const base64Jpeg = await compressImageToJpegBase64(imageUri);
  if (base64Jpeg) {
    const visionText = await recognizeViaGeminiVision(base64Jpeg);
    if (visionText.length >= 4) {
      return visionText;
    }
  }

  return await recognizeViaClientTesseract(imageUri);
}
