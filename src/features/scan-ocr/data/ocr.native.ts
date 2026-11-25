import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { traceOperation } from '@/core/observability/monitoring';
import { sanitizeOcrAndDocumentText } from '../domain/ocrCleaner';
import type { OcrOptions } from './ocr';

function pickScript(lang?: string): TextRecognitionScript {
  const code = (lang || '').toLowerCase();
  if (code.includes('jpn')) return TextRecognitionScript.JAPANESE;
  if (code.includes('kor')) return TextRecognitionScript.KOREAN;
  if (code.includes('chi')) return TextRecognitionScript.CHINESE;
  return TextRecognitionScript.LATIN;
}

export async function encodeImageUriToJpegBase64(_imageUri: string): Promise<string> {
  return '';
}

export async function recognizeLocalImage(imageUri: string, options?: OcrOptions): Promise<string> {
  return traceOperation('ocr', async () => {
    options?.onProgress?.(0.35, 'Đang nhận diện chữ trên thiết bị...');
    const result = await TextRecognition.recognize(imageUri, pickScript(options?.language));
    options?.onProgress?.(1, 'Hoàn tất!');
    return sanitizeOcrAndDocumentText(result.text);
  });
}
