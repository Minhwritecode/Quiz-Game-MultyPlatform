import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
export type PdfAttachment = { name: string; data: string };
export async function pickPdf(): Promise<PdfAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({type:'application/pdf',copyToCacheDirectory:true});
  if(result.canceled) return null;
  const asset=result.assets[0];
  if(!asset || !asset.size || asset.size > 4 * 1024 * 1024) throw new Error('PDF tối đa 4 MB. Hãy chia tài liệu lớn thành phần nhỏ.');
  const bytes=Platform.OS==='web' ? new Uint8Array(await asset.file!.arrayBuffer()) : await new (await import('expo-file-system')).File(asset.uri).bytes();
  if(bytes.length > 4 * 1024 * 1024 || String.fromCharCode(...bytes.slice(0,5))!=='%PDF-') throw new Error('Tệp PDF không hợp lệ hoặc quá lớn.');
  let binary='';
  for(let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return {name:asset.name,data:btoa(binary)};
}
