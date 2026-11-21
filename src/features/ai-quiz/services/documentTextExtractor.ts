// Client-side & base64 document reader for PDF, DOCX, MD, and TXT files.
// Reads picked DocumentPicker assets into base64 (for server-side binary PDF/DOCX extraction in Edge Functions)
// and also extracts readable text locally as an instant offline fallback.

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(bytes.length, i + chunkSize));
    binary += String.fromCharCode(...slice);
  }
  return typeof btoa === 'function' ? btoa(binary) : '';
}

function extractReadableTextFromBytes(bytes: Uint8Array, fileName: string): string {
  const lower = fileName.toLowerCase();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const raw = decoder.decode(bytes);

  if (lower.endsWith('.md') || lower.endsWith('.txt')) {
    return raw.trim();
  }

  // Extract Word XML text tags if uncompressed XML is visible
  if (raw.includes('<w:t')) {
    const matches: string[] = [];
    const regex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(raw)) !== null) {
      if (m[1]?.trim()) matches.push(m[1].trim());
    }
    if (matches.length > 0) return matches.join(' ');
  }

  // Extract PDF literal text operators (...) Tj
  const pdfLiterals: string[] = [];
  const pdfRegex = /\(([^()\\]{3,160})\)\s*(?:Tj|')/g;
  let pm: RegExpExecArray | null;
  while ((pm = pdfRegex.exec(raw)) !== null) {
    if (pm[1]?.trim()) pdfLiterals.push(pm[1].trim());
  }
  if (pdfLiterals.length > 0) {
    return pdfLiterals.join(' ');
  }

  return '';
}

export async function readDocumentPayload(
  fileUri: string,
  fileName: string
): Promise<{ fileBase64: string; extractedText: string; kind: 'pdf' | 'docx' | 'md' | 'txt' }> {
  const lower = fileName.toLowerCase();
  const kind: 'pdf' | 'docx' | 'md' | 'txt' = lower.endsWith('.docx')
    ? 'docx'
    : lower.endsWith('.pdf')
    ? 'pdf'
    : lower.endsWith('.md')
    ? 'md'
    : 'txt';

  try {
    const response = await fetch(fileUri);
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer).subarray(0, 1_800_000); // cap at ~1.8MB for fast Edge invocation
    const fileBase64 = bytesToBase64(bytes);
    const extractedText = extractReadableTextFromBytes(bytes, fileName);
    return { fileBase64, extractedText, kind };
  } catch {
    return { fileBase64: '', extractedText: '', kind };
  }
}
