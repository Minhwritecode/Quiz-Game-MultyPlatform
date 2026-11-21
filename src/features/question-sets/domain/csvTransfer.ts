import type { Question, QuestionSet } from '@/core/domain/models';

export const SAMPLE_QUIZ_CSV = [
  '"Quiz Title","Quiz Description","Question Title","Time Limit (sec)","Option 1","Option 1 is Correct","Option 2","Option 2 is Correct","Option 3","Option 3 is Correct","Option 4","Option 4 is Correct"',
  '"Kiến thức Tổng hợp Papyrus","Bộ câu hỏi mẫu nhập nhanh từ CSV.","Thủ đô của nước Pháp là thành phố nào?","15","Berlin","FALSE","Madrid","FALSE","Paris","TRUE","Rome","FALSE"',
  '"","","Hành tinh nào được mệnh danh là Hành tinh Đỏ?","20","Trái Đất","FALSE","Sao Hỏa","TRUE","Sao Mộc","FALSE","Sao Kim","FALSE"',
  '"","","Ngôn ngữ nào chạy trực tiếp trong mọi trình duyệt web hiện đại?","15","JavaScript","TRUE","Rust","FALSE","Swift","FALSE","C++","FALSE"',
].join('\n');

/** RFC-4180 compliant CSV line parser supporting quoted fields & escaped quotes (""). */
export function parseCsvRows(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim());
      if (row.some((v) => v.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((v) => v.length > 0)) rows.push(row);
  return rows;
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `"${value}"`;
}

export interface CsvImportResult {
  title: string;
  subject: string;
  questions: Question[];
  skippedRows: number;
}

/**
 * Supports two clean CSV schemas:
 * 1. Rich template (12 cols): Quiz Title, Description, Question, Time Limit, Opt1, Opt1Correct, Opt2, Opt2Correct, Opt3, Opt3Correct, Opt4, Opt4Correct
 * 2. Compact template (6-8 cols): Question, OptA, OptB, OptC, OptD, Correct(A/B/C/D or 1-4), [Explanation], [CodeSnippet]
 */
export function parseQuizCsv(raw: string, fallbackTitle = 'Bộ câu hỏi nhập từ CSV'): CsvImportResult {
  const rows = parseCsvRows(raw);
  if (rows.length < 2) {
    throw new Error('File CSV cần có ít nhất 1 dòng tiêu đề và 1 dòng câu hỏi.');
  }

  const header = rows[0]!.map((h) => h.toLowerCase());
  const isRichFormat = header.some((h) => h.includes('option 1 is correct')) || header.length >= 12;

  let title = fallbackTitle;
  let subject = 'CSV Import';
  const questions: Question[] = [];
  let skippedRows = 0;

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r]!;
    if (isRichFormat) {
      if (cols[0]) title = cols[0];
      if (cols[1] && subject === 'CSV Import') subject = cols[1].slice(0, 60);
      const content = cols[2] ?? '';
      const opts = [cols[4] ?? '', cols[6] ?? '', cols[8] ?? '', cols[10] ?? ''];
      const flags = [cols[5], cols[7], cols[9], cols[11]].map((f) => (f ?? '').toLowerCase() === 'true');
      const correctIndex = Math.max(0, flags.findIndex(Boolean));

      const nonEmpty = opts.filter((o) => o.trim().length > 0);
      if (!content.trim() || nonEmpty.length < 2) {
        skippedRows++;
        continue;
      }

      // Pad to 4 distinct options if a row only supplied 2-3 options
      const normalized = [...opts];
      const fillers = ['Không có phương án trên', 'Cả hai phương án trên', 'Chưa xác định', 'Phương án khác'];
      for (let i = 0; i < 4; i++) {
        if (!normalized[i]?.trim()) {
          normalized[i] = fillers[i]!;
        }
      }

      questions.push({
        id: `csv-${Date.now()}-${r}`,
        content: content.trim(),
        options: normalized,
        correctIndex: Math.min(correctIndex, 3),
        explanation: '',
        position: questions.length,
      });
    } else {
      const content = cols[0] ?? '';
      const opts = [cols[1] ?? '', cols[2] ?? '', cols[3] ?? '', cols[4] ?? ''];
      const rawAns = (cols[5] ?? 'A').trim().toUpperCase();
      let correctIndex = 0;
      if (['A', 'B', 'C', 'D'].includes(rawAns)) {
        correctIndex = rawAns.charCodeAt(0) - 65;
      } else {
        const parsed = Number.parseInt(rawAns, 10);
        correctIndex = Number.isInteger(parsed) && parsed >= 1 && parsed <= 4 ? parsed - 1 : 0;
      }
      if (!content.trim() || opts.some((o) => !o.trim())) {
        skippedRows++;
        continue;
      }
      questions.push({
        id: `csv-${Date.now()}-${r}`,
        content: content.trim(),
        options: opts,
        correctIndex,
        explanation: cols[6] ?? '',
        ...(cols[7]?.trim() ? { codeSnippet: cols[7].trim() } : {}),
        position: questions.length,
      });
    }
  }

  if (questions.length === 0) {
    throw new Error('Không tìm thấy câu hỏi hợp lệ nào trong CSV.');
  }

  return { title, subject, questions, skippedRows };
}

export function exportQuestionSetToCsv(set: QuestionSet): string {
  const header = [
    'Quiz Title',
    'Quiz Description',
    'Question Title',
    'Time Limit (sec)',
    'Option 1',
    'Option 1 is Correct',
    'Option 2',
    'Option 2 is Correct',
    'Option 3',
    'Option 3 is Correct',
    'Option 4',
    'Option 4 is Correct',
  ]
    .map(escapeCsvCell)
    .join(',');

  const lines = set.questions.map((q, idx) => {
    const cells = [
      idx === 0 ? set.title : '',
      idx === 0 ? set.subject : '',
      q.content,
      '20',
      q.options[0] ?? '',
      q.correctIndex === 0 ? 'TRUE' : 'FALSE',
      q.options[1] ?? '',
      q.correctIndex === 1 ? 'TRUE' : 'FALSE',
      q.options[2] ?? '',
      q.correctIndex === 2 ? 'TRUE' : 'FALSE',
      q.options[3] ?? '',
      q.correctIndex === 3 ? 'TRUE' : 'FALSE',
    ];
    return cells.map(escapeCsvCell).join(',');
  });

  return [header, ...lines].join('\n');
}
