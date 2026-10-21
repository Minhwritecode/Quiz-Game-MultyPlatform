import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';

export async function recognizeLocalImage(imageUri: string): Promise<string> {
  const result = await TextRecognition.recognize(imageUri, TextRecognitionScript.LATIN);
  return result.text;
}
