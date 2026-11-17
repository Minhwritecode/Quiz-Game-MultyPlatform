import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { unzipSync, strFromU8 } from 'fflate';

export async function pickSourceDocument(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || (asset.size ?? 0) > 5_000_000) throw new Error('Choose a document smaller than 5 MB.');
  let bytes: Uint8Array;
  if (Platform.OS === 'web') {
    if (!asset.file) throw new Error('The selected file is unavailable. Choose it again.');
    bytes = new Uint8Array(await asset.file.arrayBuffer());
  } else {
    const { File } = await import('expo-file-system');
    bytes = await new File(asset.uri).bytes();
  }
  if (bytes.length > 5_000_000) throw new Error('Choose a document smaller than 5 MB.');
  let text: string;
  if (/\.docx$/i.test(asset.name)) {
    const files = unzipSync(bytes, { filter: file => file.name === 'word/document.xml' && file.originalSize <= 2_000_000 });
    const document = files['word/document.xml'];
    if (!document) throw new Error('This Word file is invalid, encrypted or too large.');
    text = strFromU8(document).replace(/<w:tab\b[^>]*\/>/g, '\t').replace(/<w:br\b[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
      .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, value: string) => {
        const code = value.charAt(0).toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value);
        return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
      }).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  } else if (/\.txt$/i.test(asset.name) || asset.mimeType === 'text/plain') {
    text = strFromU8(bytes);
  } else throw new Error('Choose a TXT or DOCX document.');
  if (!text.trim()) throw new Error('No readable text found. Use camera OCR for scanned pages.');
  if (text.length > 30000) throw new Error('Document exceeds 30,000 characters. Import a shorter excerpt.');
  return text.trim();
}
