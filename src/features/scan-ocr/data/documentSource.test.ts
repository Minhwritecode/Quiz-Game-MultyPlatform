import { zipSync, strToU8 } from 'fflate';
import { pickSourceDocument } from './documentSource';
import * as Picker from 'expo-document-picker';
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
const pick = Picker.getDocumentAsync as jest.Mock;
function file(name: string, bytes: Uint8Array) {
  pick.mockResolvedValue({ canceled: false, assets: [{ name, size: bytes.length, file: { arrayBuffer: async () => bytes.buffer } }] });
}
test('cancel leaves source unchanged', async () => {
  pick.mockResolvedValue({ canceled: true });
  expect(await pickSourceDocument()).toBeNull();
});
test('reads Word paragraphs and escaped text locally', async () => {
  file('notes.docx', zipSync({ 'word/document.xml': strToU8('<w:document><w:p><w:r><w:t>A &amp; B</w:t></w:r></w:p><w:p><w:r><w:t>Next</w:t></w:r></w:p></w:document>') }));
  expect(await pickSourceDocument()).toBe('A & B\nNext');
});
test('rejects oversized text rather than silently truncating', async () => {
  file('notes.txt', strToU8('a'.repeat(30001)));
  await expect(pickSourceDocument()).rejects.toThrow('30,000');
});
test('rejects an archive without a Word document', async () => {
  file('broken.docx', zipSync({ 'other.xml': strToU8('not a document') }));
  await expect(pickSourceDocument()).rejects.toThrow('invalid');
});
