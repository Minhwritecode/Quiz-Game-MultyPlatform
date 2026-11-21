// Shared RAG utilities for Supabase Edge Functions:
// - Running header/footer cleaning across pages
// - Structure-aware heading chunking (preserving heading_path + page_number)
// - SHA-256 deduplication hash
// - Maximal Marginal Relevance (MMR) diversification
// - Server-side grounded citation verification ([S1]..[Sn])

export interface TextChunk {
  chunkIndex: number;
  headingPath: string;
  pageNumber: number;
  content: string;
}

export interface RetrievedChunk {
  chunkId?: string;
  documentId?: string;
  documentName: string;
  headingPath: string;
  pageNumber: number;
  content: string;
  similarity: number;
  embedding?: number[] | null;
}

export interface VerifiedCitation {
  label: string;
  chunkId?: string;
  documentName: string;
  headingPath: string;
  pageNumber: number;
  excerpt: string;
}

/**
 * Strip repeated running headers/footers that appear on >= 50% of pages (separated by form-feed \f)
 * and normalize noisy whitespace.
 */
export function cleanDocumentText(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return "";

  const pages = normalized.split("\f");
  if (pages.length < 3) {
    return normalized.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  const lineFreq = new Map<string, number>();
  for (const page of pages) {
    const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);
    const edgeLines = new Set([...lines.slice(0, 2), ...lines.slice(-2)]);
    for (const line of edgeLines) {
      if (line.length <= 90) {
        lineFreq.set(line, (lineFreq.get(line) ?? 0) + 1);
      }
    }
  }

  const threshold = Math.ceil(pages.length * 0.5);
  const repeated = new Set(
    Array.from(lineFreq.entries())
      .filter(([, count]) => count >= threshold)
      .map(([line]) => line),
  );

  return pages
    .map((page) =>
      page
        .split("\n")
        .filter((line) => !repeated.has(line.trim()))
        .join("\n")
        .trim(),
    )
    .join("\f")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Structure-aware chunking: splits cleanly at Markdown headings (# / ##) or paragraph boundaries,
 * targeting ~2600 chars (~650-800 tokens) with ~320-char overlap while tracking heading_path & page.
 */
export function chunkDocument(
  raw: string,
  options: { targetChars?: number; overlapChars?: number } = {},
): TextChunk[] {
  const cleaned = cleanDocumentText(raw);
  if (!cleaned) return [];

  const targetChars = options.targetChars ?? 2600;
  const overlapChars = options.overlapChars ?? 320;
  const pages = cleaned.split("\f");

  const chunks: TextChunk[] = [];
  let h1 = "";
  let h2 = "";
  let buffer = "";
  let bufferPage = 1;
  let bufferHeading = "";

  const currentHeadingPath = () => [h1, h2].filter(Boolean).join(" > ");

  const flush = (carryOverlap: boolean) => {
    const text = buffer.trim();
    if (!text) return;
    chunks.push({
      chunkIndex: chunks.length,
      headingPath: bufferHeading,
      pageNumber: bufferPage,
      content: text,
    });
    if (carryOverlap && text.length > overlapChars) {
      buffer = text.slice(-overlapChars).trim();
    } else {
      buffer = "";
    }
  };

  pages.forEach((pageText, pIdx) => {
    const pageNum = pIdx + 1;
    const paragraphs = pageText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

    for (const para of paragraphs) {
      const h1Match = para.match(/^#\s+(.+)$/m);
      const h2Match = para.match(/^##\s+(.+)$/m);

      if (h1Match) {
        flush(false);
        h1 = h1Match[1].trim().slice(0, 120);
        h2 = "";
        bufferHeading = currentHeadingPath();
        bufferPage = pageNum;
      } else if (h2Match) {
        flush(false);
        h2 = h2Match[1].trim().slice(0, 120);
        bufferHeading = currentHeadingPath();
        bufferPage = pageNum;
      }

      if (!buffer) {
        bufferPage = pageNum;
        bufferHeading = currentHeadingPath();
      }

      if (buffer.length + para.length + 2 > targetChars && buffer.length > 0) {
        flush(true);
        bufferPage = pageNum;
        bufferHeading = currentHeadingPath();
      }

      buffer = buffer ? `${buffer}\n\n${para}` : para;
    }
  });

  flush(false);
  return chunks;
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) {
    if (b.has(w)) inter++;
  }
  return inter / (a.size + b.size - inter);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}

/**
 * Maximal Marginal Relevance (MMR) diversification: selects diverse chunks so generated
 * questions cover the breadth of the knowledge space instead of clustering on one paragraph.
 */
export function selectWithMmr(
  candidates: RetrievedChunk[],
  limit = 10,
  lambda = 0.72,
): RetrievedChunk[] {
  if (candidates.length <= limit) return candidates;

  const tokenCache = candidates.map((c) => tokenize(c.content));
  const selectedIndices: number[] = [];
  const remaining = new Set(candidates.map((_, idx) => idx));

  // Pick the highest relevance chunk first
  let bestFirst = 0;
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].similarity > candidates[bestFirst].similarity) {
      bestFirst = i;
    }
  }
  selectedIndices.push(bestFirst);
  remaining.delete(bestFirst);

  while (selectedIndices.length < limit && remaining.size > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (const idx of remaining) {
      const cand = candidates[idx];
      let maxRedundancy = 0;
      for (const sIdx of selectedIndices) {
        const sel = candidates[sIdx];
        const sim =
          cand.embedding && sel.embedding
            ? cosineSimilarity(cand.embedding, sel.embedding)
            : jaccardSimilarity(tokenCache[idx], tokenCache[sIdx]);
        if (sim > maxRedundancy) maxRedundancy = sim;
      }
      const mmrScore = lambda * cand.similarity - (1 - lambda) * maxRedundancy;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = idx;
      }
    }

    if (bestIdx < 0) break;
    selectedIndices.push(bestIdx);
    remaining.delete(bestIdx);
  }

  return selectedIndices.map((idx) => candidates[idx]);
}

/**
 * Build labeled excerpt block [S1]..[Sn] for the LLM and a lookup map for server verification.
 */
export function buildSourceContext(chunks: RetrievedChunk[]): {
  contextText: string;
  sourceMap: Map<string, RetrievedChunk>;
} {
  const sourceMap = new Map<string, RetrievedChunk>();
  const lines: string[] = [];

  chunks.forEach((chunk, idx) => {
    const label = `S${idx + 1}`;
    sourceMap.set(label, chunk);
    const meta = [
      chunk.documentName,
      chunk.headingPath ? `Section: ${chunk.headingPath}` : "",
      `Page ${chunk.pageNumber}`,
    ]
      .filter(Boolean)
      .join(" | ");
    lines.push(`[${label}] (${meta})\n${chunk.content}`);
  });

  return { contextText: lines.join("\n\n---\n\n"), sourceMap };
}

/**
 * Verify model-emitted citation labels ([S1], S2, etc.) against real chunks and silently drop fabrications.
 */
export function resolveVerifiedCitations(
  labels: string[] | undefined,
  sourceMap: Map<string, RetrievedChunk>,
): VerifiedCitation[] {
  if (!Array.isArray(labels) || sourceMap.size === 0) return [];
  const seen = new Set<string>();
  const verified: VerifiedCitation[] = [];

  for (const rawLabel of labels) {
    const norm = String(rawLabel).replace(/[\[\]\s]/g, "").toUpperCase();
    if (!norm || seen.has(norm)) continue;
    const chunk = sourceMap.get(norm);
    if (!chunk) continue;
    seen.add(norm);
    verified.push({
      label: norm,
      chunkId: chunk.chunkId,
      documentName: chunk.documentName,
      headingPath: chunk.headingPath,
      pageNumber: chunk.pageNumber,
      excerpt: chunk.content.slice(0, 180),
    });
  }

  return verified;
}
