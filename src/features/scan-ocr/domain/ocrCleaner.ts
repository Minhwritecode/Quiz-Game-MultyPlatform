/**
 * Pure domain sanitizer for OCR, PDF, and DOCX extracted text.
 * Eliminates Tesseract diagram-border noise ("chữ người ngoài hành tinh" like `©) _* = yg =`,
 * stray symbol clusters, control characters, and Mojibake) while preserving valid Vietnamese,
 * English, CJK, numbers, and mathematical formulas.
 */

const GARBAGE_SYMBOLS_RE = /[©®™§¶¤¦¨ª«¬¯°±²³´µ¸¹º»¼½¾¿×÷øØæÆßðÐþÞ]/g;

function isPlausibleWordToken(tok: string): boolean {
  const clean = tok.replace(/^[([{'"“‘`]+|[)\]}'"”’`.,;:!?]+$/g, '');
  if (!clean) return false;

  // Valid numbers, percentages, math expressions, versions (e.g. 2026, v2.6, O(n), 2x+6=14)
  if (/^[0-9]+([.,:/%-][0-9A-Za-z]+)*$/.test(clean)) return true;
  if (/^[A-Za-z0-9_+-]{1,12}\([A-Za-z0-9_,\s+-]{1,16}\)$/.test(clean)) return true;

  // Reject tokens mixing weird punctuation inside letters (e.g. `l-ap`, `.8ø]`, `=®`, `—-'`)
  if (/[^-\p{L}\p{N}./+#]/u.test(clean)) return false;

  // Single character: only allow common meaningful Vietnamese/English single-char words or bullets
  if (clean.length === 1) {
    return /^[aAiIởỞýÝốỐàÀưƯ0-9•\-+=/]$/.test(clean);
  }

  // Reject 2-letter weird uppercase/lowercase OCR hallucinations with rare diacritics surrounded by noise
  const letterCount = (clean.match(/\p{L}/gu) || []).length;
  if (letterCount === 0 && !/^\d+$/.test(clean)) return false;

  // Reject long consonant clusters > 5 chars in Latin/Vietnamese (classic OCR hallucination like `teeenieer`)
  if (/[bcdfghjklmnpqrstvwxzBCDFGHJKLMNPQRSTVWXZ]{6,}/.test(clean)) return false;

  return true;
}

export function sanitizeOcrAndDocumentText(raw: string): string {
  if (!raw) return '';

  // 1. Normalize Unicode NFC & strip control characters + classic icon/border OCR garbage symbols
  const normalized = raw
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD]/g, ' ')
    .replace(GARBAGE_SYMBOLS_RE, ' ')
    .replace(/[_*~^`|\\]{2,}/g, ' ')
    .replace(/[—–-]{2,}/g, ' — ');

  const rawLines = normalized.split(/\r?\n/);
  const cleanedLines: string[] = [];

  for (const line of rawLines) {
    const trimmed = line.replace(/\s+/g, ' ').trim();
    if (!trimmed) continue;

    const tokens = trimmed.split(' ');
    const validTokens: string[] = [];
    let validCount = 0;

    for (const tok of tokens) {
      if (isPlausibleWordToken(tok)) {
        validTokens.push(tok);
        if (tok.replace(/[^0-9\p{L}]/gu, '').length >= 2) {
          validCount++;
        }
      }
    }

    if (validTokens.length === 0) continue;

    // Discard lines where less than 48% of tokens were plausible words (diagram border noise lines!)
    const ratio = validTokens.length / Math.max(1, tokens.length);
    if (tokens.length >= 4 && ratio < 0.48 && validCount < 3) {
      continue;
    }

    const joined = validTokens
      .join(' ')
      .replace(/^[^0-9\p{L}•\-+#(]+/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (joined.length >= 3) {
      cleanedLines.push(joined);
    }
  }

  return cleanedLines.join('\n').trim();
}

/**
 * Extracts grammatically complete sentences (never cutting mid-word or mid-clause)
 * for Story & Thread sharing.
 */
export function extractCompleteSentences(raw: string, maxSentences = 2, fallbackTitle = ''): string {
  const clean = sanitizeOcrAndDocumentText(raw).replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!clean) {
    return fallbackTitle
      ? `Khám phá chủ đề "${fallbackTitle}" với những phân tích mới nhất trên Papyrus.`
      : '';
  }

  const parts = clean
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 18);

  if (parts.length > 0) {
    // Filter out fragments starting with lowercase (mid-sentence Wikipedia snippets)
    const completeOnes = parts.filter((s) => /^[\p{Lu}0-9"“‘•]/u.test(s));
    const chosen = (completeOnes.length > 0 ? completeOnes : parts).slice(0, maxSentences);
    const result = chosen.join(' ').trim();
    return /[.!?…]$/.test(result) ? result : `${result}.`;
  }

  // Ensure starts with uppercase and ends with period
  const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
  return /[.!?…]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}
