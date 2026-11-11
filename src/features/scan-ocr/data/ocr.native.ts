import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { traceOperation } from '@/core/observability/monitoring';

export async function recognizeLocalImage(imageUri: string): Promise<string> {
  return traceOperation('ocr',async()=>{
    const result = await TextRecognition.recognize(imageUri, TextRecognitionScript.LATIN);
    return result.text;
  });
}
