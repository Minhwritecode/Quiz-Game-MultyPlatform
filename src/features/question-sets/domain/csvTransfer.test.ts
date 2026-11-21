import { exportQuestionSetToCsv, parseQuizCsv, SAMPLE_QUIZ_CSV } from './csvTransfer';
import type { QuestionSet } from '@/core/domain/models';

describe('CSV bulk import & export', () => {
  it('parses the standard rich CSV template accurately', () => {
    const result = parseQuizCsv(SAMPLE_QUIZ_CSV);
    expect(result.title).toBe('Kiến thức Tổng hợp Papyrus');
    expect(result.questions).toHaveLength(3);
    expect(result.questions[0]?.correctIndex).toBe(2);
    expect(result.questions[1]?.correctIndex).toBe(1);
    expect(result.questions[2]?.correctIndex).toBe(0);
  });

  it('parses compact CSV with code snippet column', () => {
    const csv = [
      'Question,A,B,C,D,Correct,Explanation,Code',
      '"Output?","1","2","3","4","B","2x","const x = 1 + 1;"',
    ].join('\n');
    const result = parseQuizCsv(csv);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]?.correctIndex).toBe(1);
    expect(result.questions[0]?.codeSnippet).toBe('const x = 1 + 1;');
  });

  it('round-trips a QuestionSet through export and re-import', () => {
    const set: QuestionSet = {
      id: 'set-1',
      title: 'Toán giải tích',
      subject: 'Toán học',
      updatedAt: '2026-11-21T00:00:00Z',
      syncStatus: 'synced',
      questions: [
        {
          id: 'q1',
          content: '2 + 2 bằng mấy?',
          options: ['3', '4', '5', '6'],
          correctIndex: 1,
          explanation: 'Cộng cơ bản',
          position: 0,
        },
      ],
    };
    const csv = exportQuestionSetToCsv(set);
    const reimported = parseQuizCsv(csv);
    expect(reimported.title).toBe(set.title);
    expect(reimported.questions[0]?.content).toBe('2 + 2 bằng mấy?');
    expect(reimported.questions[0]?.correctIndex).toBe(1);
  });
});
