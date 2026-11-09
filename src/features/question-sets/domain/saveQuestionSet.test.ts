import type { QuestionSet } from '@/core/domain/models';
import { saveQuestionSet } from './saveQuestionSet';

const validSet: QuestionSet = {
  id: 'set-1',
  title: 'Foundations',
  subject: 'Architecture',
  updatedAt: '2026-11-10T00:00:00.000Z',
  syncStatus: 'pending',
  questions: [{
    id: 'question-1',
    content: 'Which layer owns the business rules?',
    options: ['Domain', 'Screen', 'Database', 'Router'],
    correctIndex: 0,
    explanation: 'The domain layer owns business rules.',
    position: 0,
  }],
};

describe('saveQuestionSet', () => {
  it('delegates a valid set to the repository', async () => {
    const save = jest.fn<Promise<void>, [QuestionSet]>().mockResolvedValue();

    await saveQuestionSet({ save, list: async () => [] }, validSet);

    expect(save).toHaveBeenCalledWith(validSet);
  });

  it('rejects malformed sets before persistence', async () => {
    const save = jest.fn<Promise<void>, [QuestionSet]>().mockResolvedValue();

    await expect(saveQuestionSet({ save, list: async () => [] }, {
      ...validSet,
      questions: [{ ...validSet.questions[0]!, options: ['Only one option'] }],
    })).rejects.toThrow('invalid question');
    expect(save).not.toHaveBeenCalled();
  });
});
