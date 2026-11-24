import { unzlibSync, inflateSync, unzipSync, strFromU8 } from 'fflate';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(bytes.length, i + chunkSize));
    binary += String.fromCharCode(...slice);
  }
  return typeof btoa === 'function' ? btoa(binary) : '';
}

export function base64ToBytes(b64: string): Uint8Array {
  try {
    const clean = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64;
    if (typeof atob !== 'function') return new Uint8Array(0);
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
}

function decodePdfEscapes(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

function decodeHexPdfToken(hex: string): string {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length < 2) return '';
  // UTF-16BE BOM FEFF
  if (/^feff/i.test(clean) && clean.length >= 8) {
    let out = '';
    for (let i = 4; i + 3 < clean.length; i += 4) {
      const code = parseInt(clean.slice(i, i + 4), 16);
      if (!Number.isNaN(code) && code >= 32) out += String.fromCharCode(code);
    }
    return out;
  }
  let ascii = '';
  for (let i = 0; i + 1 < clean.length; i += 2) {
    const code = parseInt(clean.slice(i, i + 2), 16);
    if (!Number.isNaN(code) && code >= 32 && code <= 126) ascii += String.fromCharCode(code);
  }
  return ascii;
}

function collectPdfTextOperators(content: string, out: string[]) {
  // 1. Array operators [(...) -20 (...)] TJ
  const tjArrayRe = /\[([^\]]{1,2500})\]\s*TJ/g;
  let m: RegExpExecArray | null;
  while ((m = tjArrayRe.exec(content)) !== null) {
    const inner = m[1] ?? '';
    const parts: string[] = [];
    const tokenRe = /\(([^()\\]*(?:\\.[^()\\]*)*)\)|<([0-9A-Fa-f\s]{2,400})>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tokenRe.exec(inner)) !== null) {
      if (tm[1] !== undefined) parts.push(decodePdfEscapes(tm[1]));
      else if (tm[2] !== undefined) parts.push(decodeHexPdfToken(tm[2]));
    }
    const line = parts.join('').trim();
    if (line.length >= 2) out.push(line);
  }

  // 2. Single string operators (...) Tj or '
  const tjSingleRe = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*(?:Tj|')/g;
  let sm: RegExpExecArray | null;
  while ((sm = tjSingleRe.exec(content)) !== null) {
    const val = decodePdfEscapes(sm[1] ?? '').trim();
    if (val.length >= 2) out.push(val);
  }
}

export function extractTextFromPdfBytes(bytes: Uint8Array): string {
  const latin1 = new TextDecoder('latin1').decode(bytes);
  const chunks: string[] = [];

  // Decompress FlateDecode streams inside PDF
  const streamRe = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  let streamsDecoded = 0;
  while ((match = streamRe.exec(latin1)) !== null && streamsDecoded < 120) {
    const startOffset = match.index + match[0].length;
    const endIdx = latin1.indexOf('endstream', startOffset);
    if (endIdx < 0) break;
    let endOffset = endIdx;
    if (latin1[endOffset - 1] === '\n') endOffset--;
    if (latin1[endOffset - 1] === '\r') endOffset--;
    const slice = bytes.subarray(startOffset, endOffset);
    if (slice.length > 2 && slice.length < 1_000_000) {
      try {
        const inflated = unzlibSync(slice);
        collectPdfTextOperators(new TextDecoder('utf-8', { fatal: false }).decode(inflated), chunks);
        streamsDecoded++;
      } catch {
        try {
          const inflatedRaw = inflateSync(slice);
          collectPdfTextOperators(new TextDecoder('utf-8', { fatal: false }).decode(inflatedRaw), chunks);
          streamsDecoded++;
        } catch {
          // Non-flate or image stream
        }
      }
    }
    streamRe.lastIndex = endIdx + 9;
  }

  // Also scan uncompressed content
  collectPdfTextOperators(latin1, chunks);

  return chunks
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 30000);
}

export function extractTextFromPdfBase64(b64: string): string {
  const bytes = base64ToBytes(b64);
  if (bytes.length === 0) return '';
  return extractTextFromPdfBytes(bytes);
}

function extractReadableTextFromBytes(bytes: Uint8Array, fileName: string): string {
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.md') || lower.endsWith('.txt')) {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes).trim();
  }

  if (lower.endsWith('.docx')) {
    try {
      const files = unzipSync(bytes, {
        filter: (file) => file.name === 'word/document.xml' && file.originalSize <= 3_000_000,
      });
      const docXml = files['word/document.xml'];
      if (docXml) {
        return strFromU8(docXml)
          .replace(/<w:tab\b[^>]*\/>/g, '\t')
          .replace(/<w:br\b[^>]*\/>/g, '\n')
          .replace(/<\/w:p>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
      }
    } catch {
      // Fall through to raw XML scan
    }
  }

  if (lower.endsWith('.pdf') || String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-') {
    return extractTextFromPdfBytes(bytes);
  }

  const raw = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (raw.includes('<w:t')) {
    const matches: string[] = [];
    const regex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(raw)) !== null) {
      if (m[1]?.trim()) matches.push(m[1].trim());
    }
    if (matches.length > 0) return matches.join(' ');
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
    const bytes = new Uint8Array(buffer).subarray(0, 3_800_000);
    const fileBase64 = bytesToBase64(bytes);
    const extractedText = extractReadableTextFromBytes(bytes, fileName);
    return { fileBase64, extractedText, kind };
  } catch {
    return { fileBase64: '', extractedText: '', kind };
  }
}
