import { AppError } from '@/core/domain/failure';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { unzipSync, strFromU8 } from 'fflate';
import { readDocumentPayload } from '@/features/ai-quiz/services/documentTextExtractor';

export type PickedRichDocument = {
  uri: string;
  name: string;
  size?: number;
  kind: 'pdf' | 'docx' | 'md' | 'txt';
  extractedText: string;
  fileBase64: string;
};

export async function pickRichSourceDocument(): Promise<PickedRichDocument | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
    ],
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;
  const asset = picked.assets[0];
  if ((asset.size ?? 0) > 20_000_000) {
    throw new AppError('validation', 'Tài liệu vượt quá giới hạn 20 MB.');
  }
  const payload = await readDocumentPayload(asset.uri, asset.name);
  return {
    uri: asset.uri,
    name: asset.name,
    size: asset.size,
    kind: payload.kind,
    extractedText: payload.extractedText.trim(),
    fileBase64: payload.fileBase64,
  };
}

export async function pickSourceDocument(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || (asset.size ?? 0) > 5_000_000) throw new AppError('unavailable', 'Choose a document smaller than 5 MB.');
  let bytes: Uint8Array;
  if (Platform.OS === 'web') {
    if (!asset.file) throw new AppError('unavailable', 'The selected file is unavailable. Choose it again.');
    bytes = new Uint8Array(await asset.file.arrayBuffer());
  } else {
    const { File } = await import('expo-file-system');
    bytes = await new File(asset.uri).bytes();
  }
  if (bytes.length > 5_000_000) throw new AppError('unavailable', 'Choose a document smaller than 5 MB.');
  let text: string;
  if (/\.docx$/i.test(asset.name)) {
    const files = unzipSync(bytes, { filter: file => file.name === 'word/document.xml' && file.originalSize <= 2_000_000 });
    const document = files['word/document.xml'];
    if (!document) throw new AppError('unavailable', 'This Word file is invalid, encrypted or too large.');
    text = strFromU8(document).replace(/<w:tab\b[^>]*\/>/g, '\t').replace(/<w:br\b[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
      .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, value: string) => {
        const code = value.charAt(0).toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value);
        return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
      }).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  } else if (/\.txt$/i.test(asset.name) || asset.mimeType === 'text/plain') {
    text = strFromU8(bytes);
  } else throw new AppError('unavailable', 'Choose a TXT or DOCX document.');
  if (!text.trim()) throw new AppError('unavailable', 'No readable text found. Use camera OCR for scanned pages.');
  if (text.length > 30000) throw new AppError('unavailable', 'Document exceeds 30,000 characters. Import a shorter excerpt.');
  return text.trim();
}
