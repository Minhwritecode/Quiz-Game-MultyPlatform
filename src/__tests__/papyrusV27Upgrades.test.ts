import {
  extractCompleteSentences,
  sanitizeOcrAndDocumentText,
} from '@/features/scan-ocr/domain/ocrCleaner';
import {
  computeTotpCode,
  generateTotpSecretBase32,
  isValidBase64Url,
  toUnpaddedBase64Url,
  verifyTotpWindow,
} from '@/features/auth/data/securityCenter';

describe('Papyrus v2.7 OCR Sanitizer, Complete Sentences & Security Center', () => {
  it('strips noisy Tesseract diagram artifacts while preserving valid technical & Vietnamese content', () => {
    const noisyDiagramOcr = [
      '©) Voice AI Architecture _* = yg = Real-Time, Scalable and Production Ready',
      '2. -° B coerce © Core Components * | § mm X1.',
      '© Deployment Architecture (AWS + Kubernetes) .8ø]... .-8',
      'Kiến trúc Hệ điều hành và Cấu trúc dữ liệu chuẩn Đại học.',
    ].join('\n');

    const cleaned = sanitizeOcrAndDocumentText(noisyDiagramOcr);
    expect(cleaned).toContain('Voice AI Architecture');
    expect(cleaned).toContain('Real-Time, Scalable and Production Ready');
    expect(cleaned).toContain('Deployment Architecture');
    expect(cleaned).toContain('Kiến trúc Hệ điều hành và Cấu trúc dữ liệu chuẩn Đại học.');
    expect(cleaned).not.toContain('©');
    expect(cleaned).not.toContain('.8ø]');
    expect(cleaned).not.toContain('§');
  });

  it('extracts strictly complete sentences and skips mid-sentence lowercase fragments', () => {
    const rawSnippet =
      'dẫn tới kết quả bị cắt ngang câu đầu tiên. Trí tuệ nhân tạo thế hệ mới giúp cá nhân hóa lộ trình học tập đại học hiệu quả hơn. Các mô hình đa phương thức còn đọc hiểu trực tiếp sơ đồ kỹ thuật';
    const oneSentence = extractCompleteSentences(rawSnippet, 1, 'Trí tuệ nhân tạo');
    expect(oneSentence).toBe(
      'Trí tuệ nhân tạo thế hệ mới giúp cá nhân hóa lộ trình học tập đại học hiệu quả hơn.'
    );
    expect(oneSentence.endsWith('.')).toBe(true);
  });

  it('validates unpadded Base64URL identifiers and verifies RFC-6238 6-digit TOTP codes', () => {
    const encoded = toUnpaddedBase64Url('user-uuid-123456');
    expect(isValidBase64Url(encoded)).toBe(true);
    expect(isValidBase64Url('invalid=padded==')).toBe(false);
    expect(isValidBase64Url('bad:chars')).toBe(false);

    const secret = generateTotpSecretBase32(20);
    const now = 1_795_614_000_000;
    const code = computeTotpCode(secret, now);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotpWindow(secret, code)).toBe(false); // old fixed timestamp vs Date.now()
    const liveCode = computeTotpCode(secret, Date.now());
    expect(verifyTotpWindow(secret, liveCode)).toBe(true);
  });
});
