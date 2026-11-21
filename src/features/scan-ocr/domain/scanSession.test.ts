import {
  buildCombinedSourceText,
  createScanPage,
  removeScanPage,
  reorderScanPages,
  togglePageNeedsReview,
  togglePageSelected,
  updatePageText,
} from './scanSession';

describe('scanSession multi-page OCR workflow', () => {
  it('reorders, removes, updates, and toggles review flags cleanly', () => {
    const p1 = createScanPage({ id: 'p1', title: 'Trang 1', text: 'Nội dung chương 1 về giải tích rất đầy đủ.' });
    const p2 = createScanPage({ id: 'p2', title: 'Trang 2', text: 'Ngắn' });
    const p3 = createScanPage({ id: 'p3', title: 'Trang 3', text: 'Nội dung chương 3 về đại số tuyến tính.' });

    expect(p1.needsReview).toBe(false);
    expect(p2.needsReview).toBe(true);

    const moved = reorderScanPages([p1, p2, p3], 2, 0);
    expect(moved.map((p) => p.id)).toEqual(['p3', 'p1', 'p2']);

    const toggled = togglePageSelected(moved, 'p1');
    expect(toggled.find((p) => p.id === 'p1')?.selected).toBe(false);

    const reviewed = togglePageNeedsReview(toggled, 'p2');
    expect(reviewed.find((p) => p.id === 'p2')?.needsReview).toBe(false);

    const edited = updatePageText(reviewed, 'p2', 'Đoạn văn đã được chỉnh sửa sau OCR.');
    expect(edited.find((p) => p.id === 'p2')?.text).toContain('chỉnh sửa');

    const removed = removeScanPage(edited, 'p3');
    expect(removed.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('builds combined source text from selected pages and caps maxChars', () => {
    const pages = [
      createScanPage({ id: 'a', title: 'Bài 1', text: 'A'.repeat(60) }),
      createScanPage({ id: 'b', title: 'Bài 2', text: 'B'.repeat(60) }),
    ];
    const deselected = togglePageSelected(pages, 'a');
    const result = buildCombinedSourceText(deselected, 50);

    expect(result.selectedCount).toBe(1);
    expect(result.truncated).toBe(true);
    expect(result.combinedText.length).toBe(50);
    expect(result.combinedText).toContain('Bài 2');
  });
});
