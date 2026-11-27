import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { seedQuestionSets } from '@/composition/preferences';
import { gameApi } from './game.api';
import { roomApi } from './room.api';

jest.mock('@/composition/platform', () => ({
  createRealtimeKahootChannel: jest.fn(() => null),
  removeRealtimeKahootChannel: jest.fn(),
}));

describe('Kahoot Live Room Creation & Study Set Data Sync', () => {
  beforeEach(() => {
    usePapyrusStore.setState({ questionSets: [] });
  });

  it('opens any seed academic set even when user also has custom question sets in store', async () => {
    usePapyrusStore.setState({
      questionSets: [
        {
          id: 'custom-user-set-1',
          title: 'Bộ đề riêng của tôi',
          subject: 'CNTT',
          updatedAt: '2026-11-26T10:00:00.000Z',
          syncStatus: 'pending',
          questions: [
            {
              id: 'cq-1',
              content: 'Câu hỏi riêng 1?',
              options: ['A', 'B', 'C', 'D'],
              correctIndex: 1,
              explanation: 'Giải thích câu riêng 1',
              position: 0,
            },
          ],
        },
      ],
    });

    const targetSeed = seedQuestionSets.find((s) => s.id !== 'custom-user-set-1')!;
    const created = await roomApi.create(targetSeed.id, 'Michael', {
      questionSet: targetSeed,
      questionCount: 5,
      secondsPerQuestion: 30,
      maxPlayers: 8,
    });

    expect(created.roomCode).toHaveLength(6);
    expect(created.room.quizId.title).toBe(targetSeed.title);
    expect(created.room.quizId.questions.length).toBe(
      Math.min(5, targetSeed.questions.length)
    );
    expect(created.room.maxPlayers).toBe(8);
    expect(created.room.timeLimit).toBe(30);

    // Host updates time per question and max players in lobby -> synced into live question
    const updated = roomApi.updateConfig(created.roomCode, {
      secondsPerQuestion: 45,
      maxPlayers: 10,
      readTimeSec: 5,
    });
    expect(updated?.maxPlayers).toBe(10);
    expect(updated?.timeLimit).toBe(45);
    expect(updated?.readTimeSec).toBe(5);

    gameApi.startQuiz(created.roomCode);
    const currentQ = await gameApi.getCurrentQuestion(created.roomCode);
    expect(currentQ.index).toBe(0);
    expect(currentQ.totalQuestions).toBe(Math.min(5, targetSeed.questions.length));
    expect(currentQ.question).toBe(targetSeed.questions[0]!.content);
    expect(currentQ.remainingTime).toBeGreaterThanOrEqual(40);
    gameApi.endQuiz(created.roomCode);
  });
});
