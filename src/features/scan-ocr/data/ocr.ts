export interface OcrOptions {
  language?: string;
  onProgress?: (progress: number, stage: string) => void;
}

export async function recognizeLocalImage(_imageUri: string, _options?: OcrOptions): Promise<string> {
  return '';
}
