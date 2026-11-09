import type { Attempt, AttemptAnswer } from '@/core/domain/models';

export function completeAttempt(input: {
  id: string;
  questionSetId: string;
  startedAt: string;
  answers: AttemptAnswer[];
}): Attempt {
  const correctCount = input.answers.filter((answer) => answer.isCorrect).length;
  return {
    id: input.id,
    questionSetId: input.questionSetId,
    score: correctCount,
    correctCount,
    total: input.answers.length,
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    status: 'completed',
    answers: input.answers,
  };
}
