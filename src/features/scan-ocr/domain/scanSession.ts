// Pure multi-page OCR scan session domain logic (Group D — FR-02–04)
// Zero framework/infrastructure imports (Clean Architecture compliant).

export const MAX_SCAN_PAGES = 10;
export const MAX_SOURCE_CHARS = 30_000;

export type ScanPageStatus = 'pending' | 'processing' | 'done' | 'error';

export interface ScanPage {
  id: string;
  uri?: string;
  title: string;
  text: string;
  selected: boolean;
  needsReview: boolean;
  status: ScanPageStatus;
}

export function createScanPage(params: {
  id: string;
  title: string;
  text: string;
  uri?: string;
  status?: ScanPageStatus;
  needsReview?: boolean;
}): ScanPage {
  const cleanText = params.text.trim();
  return {
    id: params.id,
    uri: params.uri,
    title: params.title.trim() || 'Trang tài liệu',
    text: cleanText,
    selected: true,
    needsReview: params.needsReview ?? cleanText.length < 24,
    status: params.status ?? 'done',
  };
}

export function reorderScanPages(pages: ScanPage[], fromIndex: number, toIndex: number): ScanPage[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= pages.length ||
    toIndex >= pages.length ||
    fromIndex === toIndex
  ) {
    return pages;
  }
  const next = [...pages];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return pages;
  next.splice(toIndex, 0, moved);
  return next;
}

export function removeScanPage(pages: ScanPage[], pageId: string): ScanPage[] {
  return pages.filter((p) => p.id !== pageId);
}

export function togglePageSelected(pages: ScanPage[], pageId: string): ScanPage[] {
  return pages.map((p) => (p.id === pageId ? { ...p, selected: !p.selected } : p));
}

export function togglePageNeedsReview(pages: ScanPage[], pageId: string): ScanPage[] {
  return pages.map((p) => (p.id === pageId ? { ...p, needsReview: !p.needsReview } : p));
}

export function updatePageText(pages: ScanPage[], pageId: string, text: string): ScanPage[] {
  return pages.map((p) => (p.id === pageId ? { ...p, text } : p));
}

/**
 * Combines selected scan pages into a single structured source text capped at MAX_SOURCE_CHARS.
 */
export function buildCombinedSourceText(pages: ScanPage[], maxChars = MAX_SOURCE_CHARS): {
  combinedText: string;
  truncated: boolean;
  selectedCount: number;
  reviewCount: number;
} {
  const selected = pages.filter((p) => p.selected && p.text.trim().length > 0);
  const reviewCount = selected.filter((p) => p.needsReview).length;

  const joined = selected
    .map((p, idx) => `## ${p.title || `Trang ${idx + 1}`}\n${p.text.trim()}`)
    .join('\n\n');

  if (joined.length > maxChars) {
    return {
      combinedText: joined.slice(0, maxChars),
      truncated: true,
      selectedCount: selected.length,
      reviewCount,
    };
  }

  return {
    combinedText: joined,
    truncated: false,
    selectedCount: selected.length,
    reviewCount,
  };
}
