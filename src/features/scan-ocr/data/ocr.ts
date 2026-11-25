export interface OcrOptions {
  language?: string;
  onProgress?: (progress: number, stage: string) => void;
}

export async function encodeImageUriToJpegBase64(_imageUri: string): Promise<string> {
  return '';
}

export async function recognizeLocalImage(_imageUri: string, _options?: OcrOptions): Promise<string> {
  return '';
}
