// Server-side binary document text extractor for Supabase Edge Functions (Deno / Web Standards):
// - Binary DOCX parser: locates `word/document.xml` in ZIP container, inflates via DecompressionStream("deflate-raw"),
//   converts Heading1/Heading2 paragraphs into Markdown `#` / `##` headings, and extracts all `<w:t>` runs.
// - Binary PDF parser: locates PDF streams (including FlateDecode streams inflated via DecompressionStream("deflate"))
//   and extracts text from `BT ... ET` `Tj` / `TJ` operators and readable text blocks.

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1]! : b64.trim();
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

async function inflateBytes(
  compressed: Uint8Array,
  format: "deflate" | "deflate-raw",
): Promise<Uint8Array | null> {
  try {
    const ds = new DecompressionStream(format);
    const writer = ds.writable.getWriter();
    void writer.write(compressed);
    void writer.close();
    const out = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(out);
  } catch {
    return null;
  }
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTextFromWordXml(xml: string): string {
  const paragraphs = xml.split(/<\/w:p>/);
  const lines: string[] = [];

  for (const p of paragraphs) {
    const isH1 = /w:pStyle\s+w:val="(?:Heading1|1|Title)"/i.test(p);
    const isH2 = /w:pStyle\s+w:val="(?:Heading2|2|Subtitle)"/i.test(p);
    const runs: string[] = [];
    const regex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(p)) !== null) {
      runs.push(decodeXmlEntities(match[1]));
    }
    const line = runs.join("").trim();
    if (!line) continue;
    if (isH1) lines.push(`# ${line}`);
    else if (isH2) lines.push(`## ${line}`);
    else lines.push(line);
  }

  return lines.join("\n\n").trim();
}

/**
 * Parse a DOCX binary (ZIP archive) and extract structured Markdown text from `word/document.xml`.
 */
export async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    // ZIP Local File Header signature = 0x04034b50
    if (view.getUint32(offset, true) !== 0x04034b50) {
      offset++;
      continue;
    }
    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const fileName = decoder.decode(bytes.subarray(nameStart, nameStart + fileNameLen));
    const dataStart = nameStart + fileNameLen + extraLen;
    const dataEnd = Math.min(bytes.length, dataStart + compressedSize);

    if (fileName === "word/document.xml" && dataEnd > dataStart) {
      const slice = bytes.subarray(dataStart, dataEnd);
      if (compressionMethod === 0) {
        return extractTextFromWordXml(decoder.decode(slice));
      }
      if (compressionMethod === 8) {
        const inflated = await inflateBytes(slice, "deflate-raw");
        if (inflated) {
          return extractTextFromWordXml(decoder.decode(inflated));
        }
      }
    }

    offset = dataEnd > offset + 30 ? dataEnd : offset + 30;
  }

  // Fallback: scan raw bytes for <w:t> tags if uncompressed or non-standard header
  const rawXml = decoder.decode(bytes);
  if (rawXml.includes("<w:t")) {
    return extractTextFromWordXml(rawXml);
  }
  return "";
}

function unescapePdfLiteral(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function extractPdfOperatorsText(content: string): string[] {
  const pieces: string[] = [];
  // Match literal strings (...) inside Tj or TJ arrays
  const literalRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*(?:Tj|')/g;
  let m: RegExpExecArray | null;
  while ((m = literalRegex.exec(content)) !== null) {
    const cleaned = unescapePdfLiteral(m[1]).trim();
    if (cleaned) pieces.push(cleaned);
  }

  const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
  while ((m = tjArrayRegex.exec(content)) !== null) {
    const inner = m[1];
    const subRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
    const row: string[] = [];
    let sm: RegExpExecArray | null;
    while ((sm = subRegex.exec(inner)) !== null) {
      row.push(unescapePdfLiteral(sm[1]));
    }
    const joined = row.join("").trim();
    if (joined) pieces.push(joined);
  }

  return pieces;
}

/**
 * Parse a binary PDF buffer by scanning uncompressed and FlateDecode-compressed streams for text operators.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const latin1 = new TextDecoder("latin1");
  const utf8 = new TextDecoder("utf-8", { fatal: false });
  const raw = latin1.decode(bytes);
  const collected: string[] = [];

  // 1. Direct uncompressed text operators
  collected.push(...extractPdfOperatorsText(raw));

  // 2. Decompress FlateDecode stream blocks
  let cursor = 0;
  let streamCount = 0;
  while (cursor < raw.length && streamCount < 60) {
    const sIdx = raw.indexOf("stream", cursor);
    if (sIdx < 0) break;
    let start = sIdx + 6;
    if (raw[start] === "\r" && raw[start + 1] === "\n") start += 2;
    else if (raw[start] === "\n" || raw[start] === "\r") start += 1;

    const eIdx = raw.indexOf("endstream", start);
    if (eIdx < 0) break;
    streamCount++;
    cursor = eIdx + 9;

    const len = eIdx - start;
    if (len <= 4 || len > 500_000) continue;

    const streamBytes = bytes.subarray(start, eIdx);
    const inflated =
      (await inflateBytes(streamBytes, "deflate")) ??
      (await inflateBytes(streamBytes, "deflate-raw"));
    if (inflated) {
      const text = utf8.decode(inflated);
      collected.push(...extractPdfOperatorsText(text));
    }
  }

  const joined = collected
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return joined;
}

/**
 * Unified server-side binary/base64 document parser for PDF, DOCX, MD, and TXT.
 */
export async function extractDocumentTextFromBase64(
  fileBase64: string,
  kind: "pdf" | "docx" | "md" | "txt" | "note",
  fileName = "",
): Promise<string> {
  const bytes = base64ToBytes(fileBase64);
  const lower = fileName.toLowerCase();

  if (kind === "docx" || lower.endsWith(".docx")) {
    const docxText = await extractDocxText(bytes);
    if (docxText) return docxText;
  }

  if (kind === "pdf" || lower.endsWith(".pdf")) {
    const pdfText = await extractPdfText(bytes);
    if (pdfText) return pdfText;
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
}
