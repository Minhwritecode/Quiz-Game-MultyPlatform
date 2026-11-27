import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GenerateScreen from '@/app/create/generate';
import { dependencies } from '@/composition/dependencies';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import type { Question, QuestionSet, SourceDocument } from '@/core/domain/models';

const mockParams: { mode?: string; setId?: string; sourceId?: string; fromSignIn?: string } = {};
const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => mockRouter }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.requireActual('node:crypto').randomUUID }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/composition/dependencies', () => ({
  dependencies: {
    generation: {
      configured: true,
      generate: jest.fn(),
      jobs: jest.requireActual('@/features/quiz-generation/data/generationJobStorage').generationJobs,
      sourceHandoff: jest.requireActual('@/features/quiz-generation/data/sourceHandoff').sourceHandoff,
      online: jest.fn().mockResolvedValue(true),
      observeWake: jest.fn(() => () => {}),
    },
    questionSets: { save: jest.fn() },
    sources: { list: jest.fn(), save: jest.fn() },
    study: { clearProgress: jest.fn() },
  },
}));
jest.mock('@/shared/ui', () => {
  const { Text, Pressable, View } = jest.requireActual('react-native');
  return {
    Screen: View, Card: View, TopBar: () => null, PageHeader: () => null, usePalette: () => ({}),
    Button: ({ children, onPress, disabled, testID }: any) => (
      <Pressable testID={testID} accessibilityRole="button" disabled={disabled} onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

const owner = '00000000-0000-4000-8000-000000000001';
const otherOwner = '00000000-0000-4000-8000-000000000002';
const source: SourceDocument = {
  id: '00000000-0000-4000-8000-000000000100', title: 'Reviewed B.txt',
  text: 'Corrected source B, followed by the extra notes.', createdAt: '2026-11-27',
};
const question = (n: number): Question => ({
  id: 'question-' + n, content: 'Question ' + n, options: ['A', 'B', 'C', 'D'],
  correctIndex: 0, explanation: '', position: n - 1,
});
const generate = jest.mocked(dependencies.generation.generate);
const saveSet = jest.mocked(dependencies.questionSets.save);
const listSources = jest.mocked(dependencies.sources.list);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useAuthStore.setState({ user: null, status: 'guest' });
  usePapyrusStore.setState({ language: 'en', sourceDocument: null, sourceDocumentOwner: null, questionSets: [] });
  Object.assign(mockParams, { mode: undefined, setId: undefined, sourceId: undefined, fromSignIn: undefined });
  saveSet.mockReset().mockResolvedValue(undefined);
  listSources.mockResolvedValue([]);
  generate.mockReset();
});

function signInSource() {
  useAuthStore.setState({ user: { id: owner, displayName: 'Reviewer' }, status: 'authenticated' });
  mockParams.sourceId = source.id;
  listSources.mockResolvedValue([source]);
}

async function stream(questions: Question[]) {
  generate.mockImplementationOnce(async (_request, options) => {
    for (const item of questions) await options.onQuestion(item);
    return { count: questions.length, complete: false };
  });
}

async function generateThree() {
  await screen.findByText('Source: ' + source.title);
  await fireEvent.changeText(screen.getByTestId('set-title'), 'Water cycle');
  await fireEvent.changeText(screen.getByTestId('set-subject'), 'Science');
  await fireEvent.press(screen.getByText('5'));
  await stream([question(1), question(2), question(3)]);
  await fireEvent.press(screen.getByText('Generate AI Quiz Now'));
  await screen.findByText('Save 3 reviewed questions');
}

test('a guest can start manually without any canned questions', async () => {
  await render(<GenerateScreen />);
  expect(screen.queryByText('QUESTION 1')).toBeNull();
  expect(screen.getByText('Sign in to generate with AI')).toBeTruthy();
  await fireEvent.press(screen.getByText('Add a question'));
  await fireEvent.press(screen.getByText('Save question set'));
  expect(saveSet).not.toHaveBeenCalled();
});

test('reviewed source B takes priority until the user opens old draft A', async () => {
  signInSource();
  const old = await dependencies.generation.jobs.enqueue(owner, {
    sourceText: 'Old source A', questionCount: 5, difficulty: 'medium', languageCode: 'en',
  }, { title: 'Draft A', subject: 'Science', tags: [], sourceDocumentId: null, sourceDocumentTitle: 'Source A' });
  await render(<GenerateScreen />);
  await screen.findByText('Draft A');
  expect(generate).not.toHaveBeenCalled();
  await generateThree();
  expect(generate).toHaveBeenCalledWith(expect.objectContaining({ sourceText: source.text, questionCount: 5 }), expect.objectContaining({ ownerId: owner }));
  expect((await dependencies.generation.jobs.list(owner)).some(job => job.id === old.id)).toBe(true);
  await fireEvent.press(screen.getByText('Open draft'));
  expect(await screen.findByText('Source: Source A')).toBeTruthy();
});

test('three reviewed questions can be edited and saved, with cleanup failure and stable retries', async () => {
  signInSource();
  const unrelated = await dependencies.generation.jobs.enqueue(owner, {
    sourceText: 'Other material', questionCount: 5, difficulty: 'medium', languageCode: 'en',
  }, { title: 'Other draft', subject: '', tags: [], sourceDocumentId: null, sourceDocumentTitle: '' });
  await render(<GenerateScreen />);
  await generateThree();
  await fireEvent.changeText(screen.getByTestId('question-0-content'), 'Edited water question');
  const remove = jest.spyOn(dependencies.generation.jobs, 'remove').mockRejectedValueOnce(new Error('Storage cleanup failed'));
  try {
    await fireEvent.press(screen.getByText('Save 3 reviewed questions'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/sets'));
    const saved = saveSet.mock.calls[0]![0];
    expect(saved.questions).toHaveLength(3);
    expect(saved.questions[0]?.content).toBe('Edited water question');
    expect(usePapyrusStore.getState().questionSets).toEqual([saved]);
    await fireEvent.press(screen.getByText('Save 3 reviewed questions'));
    await waitFor(() => expect(saveSet).toHaveBeenCalledTimes(2));
    expect(saveSet.mock.calls[1]![0].id).toBe(saved.id);
    expect(usePapyrusStore.getState().questionSets).toHaveLength(1);
    expect((await dependencies.generation.jobs.list(owner)).some(job => job.id === unrelated.id)).toBe(true);
  } finally {
    remove.mockRestore();
  }
});

test('fill missing keeps edited questions and rejects duplicate streamed content', async () => {
  signInSource();
  await render(<GenerateScreen />);
  await generateThree();
  await fireEvent.changeText(screen.getByTestId('question-0-content'), 'Edited first question');
  await stream([{ ...question(6), content: 'edited first question' }, question(4), question(5)]);
  await fireEvent.press(screen.getByText('Fill 2 missing questions'));
  await screen.findByText('Save question set');
  expect(generate.mock.calls[1]?.[0]).toMatchObject({ questionCount: 2 });
  expect(generate.mock.calls[1]?.[0].excludeQuestions).toContain('Edited first question');
  await fireEvent.press(screen.getByText('Save question set'));
  await waitFor(() => expect(saveSet).toHaveBeenCalledTimes(1));
  expect(saveSet.mock.calls[0]![0].questions.map(q => q.content)).toEqual([
    'Edited first question', 'Question 2', 'Question 3', 'Question 4', 'Question 5',
  ]);
});

test('concurrent save presses and a late provider callback cannot rewrite the saved review', async () => {
  signInSource();
  let late!: () => Promise<void>;
  generate.mockImplementationOnce(async (_request, options) => {
    for (const item of [question(1), question(2), question(3)]) await options.onQuestion(item);
    late = async () => { await options.onQuestion(question(4)); };
    return { count: 3, complete: false };
  });
  let finishSave!: () => void;
  saveSet.mockImplementationOnce(() => new Promise<void>(resolve => { finishSave = resolve; }));
  await render(<GenerateScreen />);
  await screen.findByText('Source: ' + source.title);
  await fireEvent.changeText(screen.getByTestId('set-title'), 'Water cycle');
  await fireEvent.changeText(screen.getByTestId('set-subject'), 'Science');
  await fireEvent.press(screen.getByText('5'));
  await fireEvent.press(screen.getByText('Generate AI Quiz Now'));
  await screen.findByText('Save 3 reviewed questions');
  await fireEvent.changeText(screen.getByTestId('question-0-content'), 'Reviewed answer');
  const saveButton = screen.getByTestId('save-question-set');
  await act(async () => {
    await Promise.all([fireEvent.press(saveButton), fireEvent.press(saveButton)]);
  });
  expect(saveSet).toHaveBeenCalledTimes(1);
  await act(async () => { await late(); finishSave(); });
  expect(usePapyrusStore.getState().questionSets[0]?.questions.map(q => q.content))
    .toEqual(['Reviewed answer', 'Question 2', 'Question 3']);
});

test('switching accounts during generation ignores late callbacks and preserves received questions', async () => {
  signInSource();
  let deliverLate!: () => Promise<void>;
  const released = new Promise<void>(resolve => {
    generate.mockImplementationOnce(async (_request, options) => {
      await options.onQuestion(question(1));
      await new Promise<void>(finish => {
        deliverLate = async () => { await options.onQuestion(question(2)); finish(); };
        resolve();
      });
      return { count: 2, complete: false };
    });
  });
  await render(<GenerateScreen />);
  await screen.findByText('Source: ' + source.title);
  await fireEvent.press(screen.getByText('Generate AI Quiz Now'));
  await released;
  listSources.mockResolvedValue([]);
  await act(() => useAuthStore.setState({ user: { id: otherOwner, displayName: 'Other' } }));
  await act(async () => { await deliverLate(); });
  expect(screen.queryByTestId('question-0-content')).toBeNull();
  await waitFor(async () => expect((await dependencies.generation.jobs.list(owner))[0]?.status).toBe('queued'));
  expect((await dependencies.generation.jobs.list(owner))[0]?.questions.map(q => q.id)).toEqual([question(1).id]);
  expect(await dependencies.generation.jobs.list(otherOwner)).toEqual([]);
});

test('an interrupted draft can be opened explicitly and resumes from its reviewed questions', async () => {
  signInSource();
  generate.mockImplementationOnce(async (_request, options) => {
    await options.onQuestion(question(1));
    await options.onQuestion(question(2));
    throw new Error('Connection interrupted');
  });
  const editor = await render(<GenerateScreen />);
  await screen.findByText('Source: ' + source.title);
  await fireEvent.press(screen.getByText('5'));
  await fireEvent.press(screen.getByText('Generate AI Quiz Now'));
  await screen.findByText('Save 2 reviewed questions');
  await fireEvent.changeText(screen.getByTestId('question-0-content'), 'Reviewed before closing');
  await editor.unmount();

  await render(<GenerateScreen />);
  await screen.findByText('Open draft');
  expect(screen.queryByTestId('question-0-content')).toBeNull();
  await stream([question(3), question(4), question(5)]);
  await fireEvent.press(screen.getByText('Resume generation'));
  await screen.findByText('Save question set');
  expect(screen.getByTestId('question-0-content').props.value).toBe('Reviewed before closing');
  expect(generate.mock.calls[1]?.[0]).toMatchObject({ questionCount: 3 });
  expect(generate.mock.calls[1]?.[1].requestId).not.toBe(generate.mock.calls[0]?.[1].requestId);
});

test('guest sign-in handoff opens the reviewed source in the claiming account only', async () => {
  mockParams.sourceId = source.id;
  listSources.mockResolvedValue([source]);
  const guest = await render(<GenerateScreen />);
  await screen.findByText('Source: ' + source.title);
  await fireEvent.press(screen.getByText('Sign in to generate with AI'));
  expect(mockRouter.push).toHaveBeenCalledWith('/auth');
  await guest.unmount();
  const handoff = dependencies.generation.sourceHandoff;
  expect(await handoff.claim(owner, () => true)).toBe(source.id);
  expect(await handoff.claim(otherOwner, () => true)).toBeNull();
  expect(await handoff.complete(otherOwner, source.id, dependencies.sources.save)).toBeNull();
  expect(dependencies.sources.save).not.toHaveBeenCalled();

  signInSource();
  listSources.mockResolvedValue([]);
  mockParams.fromSignIn = '1';
  await render(<GenerateScreen />);
  await screen.findByText('Source: ' + source.title);
  expect(dependencies.sources.save).toHaveBeenCalledWith(source);
  expect(await handoff.claim(otherOwner, () => true)).toBeNull();
});

test('manual entry saves, CSV imports, and an edit keeps the original set ID', async () => {
  mockParams.mode = 'manual';
  const editor = await render(<GenerateScreen />);
  await fireEvent.changeText(screen.getByTestId('set-title'), 'Manual set');
  await fireEvent.changeText(screen.getByTestId('set-subject'), 'Science');
  await fireEvent.changeText(screen.getByTestId('question-0-content'), 'Question');
  for (const [i, option] of ['A', 'B', 'C', 'D'].entries()) {
    await fireEvent.changeText(screen.getByTestId(`question-0-option-${i}`), option);
  }
  await fireEvent.press(screen.getByTestId('save-question-set'));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/sets'));
  const saved: QuestionSet = saveSet.mock.calls[0]![0];
  await editor.unmount();
  mockParams.setId = saved.id;
  await render(<GenerateScreen />);
  await fireEvent.press(screen.getByText(/CSV Import \/ Export/));
  await fireEvent.press(screen.getByText('Nạp CSV mẫu'));
  await fireEvent.press(screen.getByText('Nhập vào bộ đề'));
  await fireEvent.press(screen.getByTestId('save-question-set'));
  await waitFor(() => expect(saveSet).toHaveBeenCalledTimes(2));
  expect(saveSet.mock.calls[1]![0].id).toBe(saved.id);
  expect(saveSet.mock.calls[1]![0].questions.length).toBeGreaterThan(1);
});
