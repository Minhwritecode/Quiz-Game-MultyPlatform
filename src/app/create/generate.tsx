import { useAuthStore } from '@/core/state/useAuthStore';
import { randomUUID } from 'expo-crypto';
import { errorMessage } from '@/core/domain/failure';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, PageHeader, Screen, TopBar, usePalette } from '@/shared/ui';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { dependencies } from '@/composition/dependencies';
import { saveQuestionSet } from '@/features/question-sets/domain/saveQuestionSet';
import { exportQuestionSetToCsv, parseQuizCsv, SAMPLE_QUIZ_CSV } from '@/features/question-sets/domain/csvTransfer';
import { useI18n } from '@/core/i18n';
import {
  isValidQuestion,
  type GenerationRequest,
  type Question,
  type QuestionSet,
  type QuestionType,
} from '@/core/domain/models';
import type { GenerationJob } from '@/features/quiz-generation/domain/generationJobs';
import { spacing, typography } from '@/core/theme/tokens';

const liveJobs = new Set<string>();

const displayQuestions = (job: GenerationJob) => {
  if (job.review) return job.review.questions;
  if (!job.replaceQuestionId) return [...job.initialQuestions, ...job.questions].map((q, position) => ({ ...q, position }));
  const replacement = job.questions[0];
  return job.initialQuestions.map((question, position) => ({
    ...(question.id === job.replaceQuestionId && replacement ? replacement : question), position,
  }));
};
const tagValues = (text: string) => [...new Set(text.split(',').map(tag => tag.trim()).filter(Boolean).map(tag => tag.slice(0, 30)))].slice(0, 10);
const createLocalId = () => randomUUID() || `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function GenerateScreen() {
  const account = useAuthStore(state => state.user?.id ?? 'guest');
  const params = useLocalSearchParams<{ mode?: string; setId?: string; sourceId?: string; fromSignIn?: string }>();
  return <GenerationEditor key={account + ':' + (params.setId ?? '') + ':' + (params.mode ?? '') + ':' + (params.sourceId ?? '')} />;
}

function GenerationEditor() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; setId?: string; sourceId?: string; fromSignIn?: string }>();
  const manualMode = params.mode === 'manual';
  const existingSet = usePapyrusStore((state) => state.questionSets.find((item) => item.id === params.setId));
  const { language, t } = useI18n();
  const [title, setTitle] = useState(existingSet?.title ?? '');
  const [subject, setSubject] = useState(existingSet?.subject ?? '');
  const [tagText, setTagText] = useState((existingSet?.tags ?? []).join(', '));
  const [message, setMessage] = useState('');
  const palette = usePalette();
  const saveToStore = usePapyrusStore((state) => state.saveQuestionSet);
  const account = useAuthStore(state => state.user?.id ?? null);
  const requestedSourceId = params.sourceId ?? existingSet?.sourceDocumentId;
  const knownSource = usePapyrusStore((state) => {
    if (state.sourceDocumentOwner !== account) return null;
    const document = state.sourceDocument;
    if (requestedSourceId) return document?.id === requestedSourceId ? document : null;
    return manualMode || params.setId ? null : document;
  });
  const [sourceText, setSourceText] = useState(knownSource?.text ?? '');
  const [sourceDocumentId, setSourceDocumentId] = useState<string | null>(requestedSourceId ?? knownSource?.id ?? null);
  const [sourceTitle, setSourceTitle] = useState(knownSource?.title ?? '');
  const [questions, setQuestions] = useState<Question[]>(() => existingSet?.questions ?? (manualMode ? [{ id: createLocalId(), content: '', options: ['', '', '', ''], correctIndex: 0, explanation: '', position: 0 }] : []));
  const [openCodeIds, setOpenCodeIds] = useState<Record<string, boolean>>({});
  const [csvPanelOpen, setCsvPanelOpen] = useState(false);
  const [csvRawText, setCsvRawText] = useState('');
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Balanced' | 'Challenge'>('Balanced');
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const selectedJob = useRef<string | null>(null);
  const [initialDraftId] = useState(() => existingSet?.id ?? createLocalId());
  const draftSetId = useRef(initialDraftId);
  const generation = useRef<{ id: string; controller: AbortController } | null>(null);
  const locked = useRef(false);
  const mounted = useRef(true);

  const alive = useCallback(() => mounted.current && (useAuthStore.getState().user?.id ?? null) === account, [account]);
  const refreshJobs = useCallback(async (owner: string) => {
    const next = await dependencies.generation.jobs.list(owner);
    if (alive()) setJobs(next);
  }, [alive]);

  const withEditorLock = useCallback(async (work: () => Promise<void>) => {
    if (locked.current || !alive()) return;
    locked.current = true;
    setBusy(true);
    try {
      await work();
    } catch (error) {
      if (alive()) setMessage(errorMessage(error, language === 'vi' ? 'Thao tác chưa hoàn tất. Hãy thử lại.' : 'The action could not finish. Try again.'));
    } finally {
      locked.current = false;
      if (alive()) setBusy(false);
    }
  }, [alive, language]);

  const selectJob = (job: GenerationJob | null) => {
    selectedJob.current = job?.id ?? null;
    setSelectedJobId(selectedJob.current);
  };

  const showJob = (job: GenerationJob) => {
    const details = job.review?.metadata ?? job.metadata;
    selectJob(job);
    draftSetId.current = job.draftSetId ?? job.id;
    setTitle(details.title);
    setSubject(details.subject);
    setTagText(details.tags.join(', '));
    setCount(job.review?.count ?? (job.replaceQuestionId ? job.initialQuestions.length : job.initialQuestions.length + job.request.questionCount));
    setSourceText(job.request.sourceText);
    setSourceDocumentId(details.sourceDocumentId);
    setSourceTitle(details.sourceDocumentTitle);
    setDifficulty(job.request.difficulty === 'easy' ? 'Easy' : job.request.difficulty === 'hard' ? 'Challenge' : 'Balanced');
    setQuestions(displayQuestions(job));
    setMessage(job.error ?? '');
  };

  const runJob = useCallback(async (job: GenerationJob, owner: string) => {
    const id = job.id;
    if (!alive() || selectedJob.current !== id || liveJobs.has(id)) return;
    if (!(await dependencies.generation.online())) {
      if (alive()) setMessage(language === 'vi' ? 'Đã lưu bản nháp. Bạn có thể tạo tiếp khi có mạng.' : 'Draft saved. You can resume when back online.');
      return;
    }
    if (!alive() || selectedJob.current !== id || liveJobs.has(id)) return;

    liveJobs.add(id);
    const controller = new AbortController();
    generation.current = { id, controller };
    const isCurrent = () => alive() && selectedJob.current === id
      && generation.current?.controller === controller && !controller.signal.aborted;
    let requestId: string | undefined;
    try {
      const runningJob = await dependencies.generation.jobs.markRunning(owner, id);
      if (!runningJob) return;
      requestId = runningJob.requestId;
      if (!isCurrent()) return;
      setMessage(language === 'vi' ? 'Đang nhận câu hỏi…' : 'Receiving questions…');
      await refreshJobs(owner);
      const missing = runningJob.request.questionCount - runningJob.questions.length;
      if (missing > 0) {
        const excluded = [
          ...(runningJob.request.excludeQuestions ?? []),
          ...displayQuestions(runningJob).filter(item => item.id !== runningJob.replaceQuestionId).map(item => item.content),
          ...runningJob.questions.map(item => item.content),
        ];
        await dependencies.generation.generate({
          ...runningJob.request, questionCount: missing,
          excludeQuestions: [...new Set(excluded)].slice(0, 30),
        }, {
          requestId,
          ownerId: owner,
          signal: controller.signal,
          onQuestion: async question => {
            if (!isCurrent()) return;
            const updated = await dependencies.generation.jobs.appendQuestion(owner, id, question, runningJob.requestId);
            if (updated?.requestId === runningJob.requestId && updated.status === 'running' && isCurrent()) {
              setQuestions(displayQuestions(updated));
            }
          },
        });
      }
      if (!isCurrent()) return;
      const current = (await dependencies.generation.jobs.list(owner)).find(item => item.id === id);
      if (!current || !isCurrent()) return;
      const actual = current.questions.length;
      if (!actual) {
        const empty = language === 'vi' ? 'AI chưa trả về câu hỏi hợp lệ. Bạn có thể thử lại.' : 'No valid questions were received. You can retry.';
        await dependencies.generation.jobs.fail(owner, id, empty, requestId);
        if (isCurrent()) setMessage(empty);
      } else {
        await dependencies.generation.jobs.complete(owner, id, requestId);
        if (isCurrent()) setMessage(actual >= runningJob.request.questionCount
          ? (language === 'vi' ? 'Hãy rà đáp án trước khi lưu.' : 'Review the answers before saving.')
          : (language === 'vi' ? 'Bạn có thể tạo bù hoặc lưu các câu đã duyệt.' : 'Fill the remaining questions or save what you reviewed.'));
      }
    } catch (error) {
      if (!isCurrent()) return;
      const failure = errorMessage(error, language === 'vi' ? 'Tạo câu hỏi bị gián đoạn. Bạn có thể thử lại.' : 'Generation was interrupted. You can retry.');
      if (requestId) await dependencies.generation.jobs.fail(owner, id, failure, requestId);
      if (isCurrent()) setMessage(failure);
    } finally {
      try {
        if (requestId && (!alive() || controller.signal.aborted)) await dependencies.generation.jobs.interrupt(owner, id, requestId);
      } finally {
        liveJobs.delete(id);
        generation.current = null;
        await refreshJobs(owner);
      }
    }
  }, [alive, language, refreshJobs]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current?.controller.abort();
    };
  }, []);

  const loadSource = useCallback(async () => {
    if (!requestedSourceId) return;
    let document = knownSource;
    if (!document && account && params.fromSignIn === '1') {
      document = await dependencies.generation.sourceHandoff.complete(account, requestedSourceId, (item) => {
        if (!alive()) return Promise.reject(new Error('Account changed.'));
        return dependencies.sources.save(item);
      });
    }
    document ??= (await dependencies.sources.list()).find(item => item.id === requestedSourceId) ?? null;
    if (!alive() || selectedJob.current) return;
    if (!document) throw new Error(language === 'vi' ? 'Không tìm thấy tài liệu trong tài khoản này.' : 'This source is unavailable in this account.');
    setSourceText(document.text);
    setSourceDocumentId(document.id);
    setSourceTitle(document.title);
  }, [account, alive, language, params.fromSignIn, requestedSourceId, knownSource]);

  useEffect(() => {
    if (requestedSourceId && !knownSource) {
      void loadSource().catch(error => {
        if (alive() && !selectedJob.current) setMessage(errorMessage(error, 'Cannot load the selected source.'));
      });
    }
  }, [alive, knownSource, loadSource, requestedSourceId]);

  useEffect(() => {
    if (!account || manualMode) return;
    let cancelled = false;
    void dependencies.generation.jobs.recover(account, liveJobs).then(items => {
      if (!cancelled && alive()) setJobs(items);
    }).catch(() => {
      if (!cancelled && alive()) setMessage('Could not restore the saved generation queue.');
    });
    return () => { cancelled = true; };
  }, [account, alive, manualMode]);

  const resumeQueued = useCallback(async () => {
    if (!account || !selectedJobId || locked.current) return;
    const job = (await dependencies.generation.jobs.list(account)).find(item => item.id === selectedJobId);
    if (job?.status === 'queued' && selectedJob.current === job.id && await dependencies.generation.online()) {
      await withEditorLock(() => runJob(job, account));
    }
  }, [account, runJob, selectedJobId, withEditorLock]);

  useEffect(() => {
    if (!account || !selectedJobId) return;
    const wake = () => { void resumeQueued().catch(() => undefined); };
    const stop = dependencies.generation.observeWake(wake);
    const timer = setInterval(wake, 30_000);
    return () => { stop(); clearInterval(timer); };
  }, [account, resumeQueued, selectedJobId]);

  useEffect(() => {
    if (!account || !selectedJobId || busy || locked.current || selectedJob.current !== selectedJobId) return;
    void dependencies.generation.jobs.saveReview(account, selectedJobId, {
      metadata: { title, subject, tags: tagValues(tagText), sourceDocumentId, sourceDocumentTitle: sourceTitle },
      questions, count,
    }).catch(() => {
      if (alive() && selectedJob.current === selectedJobId) setMessage(language === 'vi' ? 'Chưa lưu được chỉnh sửa vào bản nháp. Hãy lưu bộ đề hoặc thử lại.' : 'Could not store draft edits. Save the question set or retry.');
    });
  }, [account, alive, busy, count, language, questions, selectedJobId, sourceDocumentId, sourceTitle, subject, tagText, title]);

  const startJob = (request: GenerationRequest, initialQuestions: Question[] = [], replaceQuestionId?: string) => withEditorLock(async () => {
    if (manualMode || !account || !dependencies.generation.configured || !request.sourceText.trim()) return;
    setMessage('');
    const metadata = { title: title.trim(), subject: subject.trim(), tags: tagValues(tagText), sourceDocumentId, sourceDocumentTitle: sourceTitle };
    const job = await dependencies.generation.jobs.enqueue(account, request, metadata, initialQuestions, replaceQuestionId, draftSetId.current);
    if (!alive()) return;
    selectJob(job);
    setQuestions([...initialQuestions]);
    await refreshJobs(account);
    await runJob(job, account);
  });

  const makeRequest = (questionCount: number): GenerationRequest => ({
    sourceText, questionCount,
    difficulty: difficulty === 'Easy' ? 'easy' : difficulty === 'Challenge' ? 'hard' : 'medium',
    languageCode: language,
  });

  const generate = () => startJob(makeRequest(count));
  const fillMissing = () => {
    const accepted = questions.filter(isValidQuestion);
    if (accepted.length !== questions.length || accepted.length >= count) return;
    void startJob({ ...makeRequest(count - accepted.length), excludeQuestions: accepted.map(item => item.content) }, accepted);
  };
  const regenerate = (question: Question) => void startJob({
    ...makeRequest(1),
    excludeQuestions: questions.filter(item => item.id !== question.id).map(item => item.content),
  }, questions, question.id);

  const openJob = (id: string, retry = false) => withEditorLock(async () => {
    if (!account) return;
    let job = (await dependencies.generation.jobs.list(account)).find(item => item.id === id);
    if (!job || !alive()) return;
    if (retry) job = await dependencies.generation.jobs.retry(account, id) ?? undefined;
    if (!job || !alive()) return;
    showJob(job);
    if (retry) await runJob(job, account);
  });

  const cancelJob = async (job: GenerationJob) => {
    if (!account || !alive() || (locked.current && generation.current?.id !== job.id)) return;
    if (generation.current?.id === job.id) generation.current.controller.abort();
    if (selectedJob.current === job.id) selectJob(null);
    try {
      await dependencies.generation.jobs.remove(account, job.id);
      await refreshJobs(account);
      if (alive()) setMessage(language === 'vi' ? 'Đã hủy công việc tạo đề.' : 'Generation job cancelled.');
    } catch (error) {
      if (alive()) setMessage(errorMessage(error, 'Could not remove the generation job.'));
    }
  };

  const signInForSource = () => withEditorLock(async () => {
    const document = knownSource ?? (await dependencies.sources.list()).find(item => item.id === sourceDocumentId);
    if (!alive()) return;
    if (!document && sourceDocumentId) throw new Error(language === 'vi' ? 'Hãy tải lại tài liệu trước khi đăng nhập.' : 'Reload the source before signing in.');
    if (document) await dependencies.generation.sourceHandoff.stage(document);
    if (alive()) router.push('/auth');
  });

  const updateQuestion = (questionId: string, update: (question: Question) => Question) => {
    setQuestions((current) => current.map((question) => question.id === questionId ? update(question) : question));
  };

  const removeQuestion = (questionId: string) => {
    setQuestions((current) => current.filter((question) => question.id !== questionId).map((question, position) => ({ ...question, position })));
  };

  const save = () => withEditorLock(async () => {
    if (!title.trim() || !subject.trim() || !questions.length || questions.some(question => !isValidQuestion(question))) {
      setMessage(t.home.saveError);
      return;
    }
    setMessage('');
    const jobId = selectedJob.current;
    const questionSet: QuestionSet = {
      id: existingSet?.id ?? draftSetId.current,
      title: title.trim(),
      subject: subject.trim(),
      tags: tagValues(tagText),
      sourceDocumentId,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
      questions,
    };
    await saveQuestionSet(dependencies.questionSets, questionSet);
    if (!alive()) return;
    selectJob(null);
    saveToStore(questionSet);
    if (existingSet) void dependencies.study.clearProgress(existingSet.id).catch(() => undefined);
    if (account && jobId) void dependencies.generation.jobs.remove(account, jobId).catch(() => undefined);
    router.replace('/sets');
  });

  const queueJobs = jobs.filter(job => job.status !== 'cancelled');
  const validCount = questions.filter(isValidQuestion).length;
  const partial = !manualMode && validCount > 0 && validCount < count && validCount === questions.length;
  const canGenerate = !busy && Boolean(account && dependencies.generation.configured && sourceText.trim());
  return <Screen>
    <TopBar title={existingSet ? t.home.editSet : manualMode ? t.home.manualTitle : (language === 'vi' ? 'Tạo & chỉnh sửa bộ đề' : 'Shape your quiz')} />
    <PageHeader
      eyebrow={manualMode ? t.home.manualEyebrow : (language === 'vi' ? 'BƯỚC 2 / 3 · TẠO BỘ ĐỀ AI' : 'STEP 2 OF 3 · SHAPE')}
      title={existingSet ? t.home.editSet : manualMode ? t.home.manualTitle : (language === 'vi' ? 'Thiết lập & tạo câu hỏi' : 'Make the generation yours')}
      subtitle={manualMode ? t.home.manualSubtitle : (language === 'vi' ? 'Chọn số câu và độ khó, kiểm tra đáp án rồi lưu bộ đề vào thư viện.' : 'Choose the output, review every answer and save only what you trust.')}
    />
    <Card style={styles.controls}>
      {!manualMode && <Text style={[typography.caption, { color: palette.inkMuted }]}>{language === 'vi' ? 'AI sẽ sinh câu hỏi bám sát nội dung bạn đã duyệt. Bạn có thể sửa lại bất kỳ câu hỏi nào trước khi lưu.' : 'AI generates questions grounded in your reviewed text. You can edit any question before saving.'}</Text>}
      <TextInput testID="set-title" editable={!busy} accessibilityLabel="Question set title" placeholder={language === 'vi' ? 'Tên bộ câu hỏi (ví dụ: Lịch sử Chương 3)' : 'Question set title'} placeholderTextColor={palette.inkMuted} value={title} onChangeText={setTitle} maxLength={160} style={[styles.questionInput, { color: palette.ink, borderColor: palette.paperMuted }]} />
      <TextInput testID="set-subject" editable={!busy} accessibilityLabel={t.home.subjectLabel} placeholder={t.home.subjectPlaceholder} placeholderTextColor={palette.inkMuted} value={subject} onChangeText={setSubject} maxLength={100} style={[styles.questionInput, { color: palette.ink, borderColor: palette.paperMuted }]} />
      <TextInput testID="set-tags" editable={!busy} accessibilityLabel={language === 'vi' ? 'Thẻ của bộ đề, cách nhau bằng dấu phẩy' : 'Question set tags, comma separated'} placeholder={language === 'vi' ? 'Thẻ: đại số, chương 2, ôn thi' : 'Tags: algebra, chapter 2, exam'} placeholderTextColor={palette.inkMuted} value={tagText} onChangeText={setTagText} maxLength={400} style={[styles.questionInput, { color: palette.ink, borderColor: palette.paperMuted }]} />
      {!manualMode && <Text style={[typography.caption, { color: palette.inkMuted }]}>{language === 'vi' ? 'Nguồn: ' : 'Source: '}{sourceTitle || (questions.length ? (language === 'vi' ? 'Khôi phục từ phiên trước' : 'Restored from saved job') : (language === 'vi' ? 'Chưa có tài liệu nguồn' : 'No source attached'))}</Text>}
      {message ? <Text accessibilityRole="alert" style={{ color: palette.danger, fontWeight: '600' }}>{message}</Text> : null}
      {!manualMode && <>
        {!account && <Button variant="secondary" disabled={busy || !dependencies.generation.configured} onPress={() => void signInForSource()}>
          {language === 'vi' ? 'Đăng nhập để tạo bằng AI' : 'Sign in to generate with AI'}
        </Button>}
        {!dependencies.generation.configured && <Text style={[typography.caption, { color: palette.inkMuted }]}>
          {language === 'vi' ? 'AI chưa được cấu hình. Bạn có thể soạn câu hỏi thủ công.' : 'AI is unavailable here. You can still write questions manually.'}
        </Text>}
        {requestedSourceId && !sourceText && message && <Button variant="secondary" disabled={busy} onPress={() => void withEditorLock(loadSource)}>
          {language === 'vi' ? 'Tải lại tài liệu' : 'Reload source'}
        </Button>}
        <Text style={[typography.title, { color: palette.ink }]}>{language === 'vi' ? 'Số lượng câu hỏi' : 'Question count'}</Text>
        <View style={styles.choiceRow}>{[5, 10, 15].map((value) => <Button key={value} variant={count === value ? 'primary' : 'secondary'} onPress={() => setCount(value)} disabled={busy}>{String(value)}</Button>)}</View>
        <Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>{language === 'vi' ? 'Độ khó' : 'Difficulty'}</Text>
        <View style={styles.choiceRow}>{(['Easy', 'Balanced', 'Challenge'] as const).map((value) => <Button key={value} variant={difficulty === value ? 'primary' : 'secondary'} onPress={() => setDifficulty(value)} disabled={busy}>{language === 'vi' ? (value === 'Easy' ? 'Dễ' : value === 'Balanced' ? 'Trung bình' : 'Thử thách') : value}</Button>)}</View>
        <Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.xs }]}>{validCount} / {count} {language === 'vi' ? 'câu sẵn sàng' : 'ready'} · {language === 'vi' ? 'Tiếng Việt' : 'English'}</Text>
        <View style={{ marginTop: spacing.sm }}>
          <Button icon="sparkles" variant="primary" disabled={!canGenerate} onPress={() => void generate()} fullWidth>
            {busy ? (language === 'vi' ? 'AI đang tạo câu hỏi…' : 'Generating…') : (language === 'vi' ? 'Tạo Quiz bằng AI ngay' : 'Generate AI Quiz Now')}
          </Button>
        </View>
      </>}
    </Card>

    {!manualMode && !params.setId && queueJobs.length > 0 && <Card style={styles.queueCard}>
      <Text style={[typography.title, { color: palette.ink }]}>{language === 'vi' ? 'Hàng đợi tạo đề' : 'Generation queue'}</Text>
      {queueJobs.map(job => <View key={job.id} style={styles.jobRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.label, { color: palette.ink }]}>{job.metadata.title || (language === 'vi' ? 'Bộ đề chưa đặt tên' : 'Untitled question set')}</Text>
          <Text style={[typography.caption, { color: palette.inkMuted }]}>
            {job.metadata.sourceDocumentTitle} · {job.status} · {job.questions.length}/{job.request.questionCount}
          </Text>
        </View>
        {job.id !== selectedJobId && <Button variant="ghost" disabled={busy} onPress={() => void openJob(job.id)}>
          {language === 'vi' ? 'Mở bản nháp' : 'Open draft'}
        </Button>}
        {(job.status === 'queued' || job.status === 'failed') && <Button variant="secondary" disabled={busy} onPress={() => void openJob(job.id, true)}>
          {language === 'vi' ? 'Tạo tiếp' : 'Resume generation'}
        </Button>}
        <Pressable accessibilityRole="button" accessibilityLabel={language === 'vi' ? 'Hủy công việc' : 'Cancel job'} onPress={() => void cancelJob(job)} style={styles.removeButton}><Ionicons name="close-circle-outline" size={22} color={palette.danger} /></Pressable>
      </View>)}
    </Card>}

    <Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl, marginBottom: spacing.md }]}>{manualMode ? t.home.correctAnswerHint : 'Review before saving'}</Text>
    {questions.length === 0 && <Card><Text style={[typography.body, { color: palette.inkMuted }]}>No questions yet. Generate from your saved source or write them manually.</Text></Card>}
    {partial && <Button variant="secondary" disabled={!canGenerate} onPress={fillMissing}>{language === 'vi' ? 'Tạo bù ' + (count - validCount) + ' câu' : 'Fill ' + (count - validCount) + ' missing questions'}</Button>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm }}>
      <Button
        variant="secondary"
        disabled={busy || questions.length >= 30}
        onPress={() =>
          setQuestions((current) => [
            ...current,
            { id: createLocalId(), content: '', options: ['', '', '', ''], correctIndex: 0, explanation: '', position: current.length },
          ])
        }
      >
        {t.home.addQuestion}
      </Button>
      <Button variant="ghost" disabled={busy} onPress={() => setCsvPanelOpen((v) => !v)}>
        {language === 'vi' ? '📥 Nhập / Xuất CSV' : '📥 CSV Import / Export'}
      </Button>
    </View>
    {csvPanelOpen && (
      <Card style={{ marginBottom: spacing.md, gap: spacing.xs }}>
        <Text style={[typography.label, { color: palette.indigo }]}>NHẬP HOẶC XUẤT BỘ ĐỀ QUA CSV</Text>
        <TextInput
          value={csvRawText}
          onChangeText={setCsvRawText}
          multiline
          placeholder="Dán nội dung CSV vào đây hoặc bấm Nạp CSV mẫu..."
          placeholderTextColor={palette.inkMuted}
          style={[styles.questionInput, { minHeight: 84, color: palette.ink, borderColor: palette.paperMuted }]}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button variant="ghost" onPress={() => setCsvRawText(SAMPLE_QUIZ_CSV)}>
            Nạp CSV mẫu
          </Button>
          <Button
            variant="primary"
            onPress={() => {
              try {
                const parsed = parseQuizCsv(csvRawText, title || 'Bộ đề CSV');
                if (!title.trim()) setTitle(parsed.title);
                if (!subject.trim()) setSubject(parsed.subject);
                setQuestions((prev) =>
                  [...prev.filter((q) => q.content.trim().length > 0), ...parsed.questions].map((q, idx) => ({
                    ...q,
                    position: idx,
                  }))
                );
                setCsvPanelOpen(false);
                setMessage(`Đã nhập thành công ${parsed.questions.length} câu hỏi từ CSV!`);
              } catch (err) {
                setMessage(err instanceof Error ? err.message : 'Định dạng CSV chưa hợp lệ.');
              }
            }}
          >
            Nhập vào bộ đề
          </Button>
          {questions.length > 0 && (
            <Button
              variant="secondary"
              onPress={() => {
                const csv = exportQuestionSetToCsv({
                  id: existingSet?.id || 'export',
                  title: title || 'Papyrus Quiz',
                  subject: subject || 'General',
                  updatedAt: new Date().toISOString(),
                  syncStatus: 'synced',
                  questions,
                });
                setCsvRawText(csv);
                void Share.share({ message: csv }).catch(() => undefined);
              }}
            >
              Xuất ra CSV
            </Button>
          )}
        </View>
      </Card>
    )}
    {questions.map((question, index) => <Card key={question.id || `question-${index}`} style={styles.question}>
      <View style={styles.questionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[typography.label, { color: palette.indigo }]}>{t.home.questionLabel.toLocaleUpperCase()} {index + 1}</Text>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: isValidQuestion(question) ? palette.mintTint : palette.goldTint,
            }}
          >
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: '800',
                color: isValidQuestion(question) ? palette.mint : palette.gold,
              }}
            >
              {isValidQuestion(question)
                ? language === 'vi'
                  ? 'Hợp lệ'
                  : 'Ready'
                : language === 'vi'
                  ? 'Cần điền đủ'
                  : 'Incomplete'}
            </Text>
          </View>
        </View>
        <View style={styles.questionActions}>
          {!manualMode && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={(language === 'vi' ? 'Sinh lại câu ' : 'Regenerate question ') + (index + 1)}
              disabled={!canGenerate}
              onPress={() => regenerate(question)}
              style={styles.removeButton}
            >
              <Ionicons name="refresh" size={20} color={palette.indigo} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t.home.removeQuestion} ${index + 1}`}
            disabled={busy}
            onPress={() => removeQuestion(question.id)}
            style={styles.removeButton}
          >
            <Ionicons name="trash-outline" size={20} color={palette.danger} />
          </Pressable>
        </View>
      </View>
      <View style={styles.typeWrap}>
        {(
          [
            { id: 'multiple_choice', label: '4 lựa chọn' },
            { id: 'true_false', label: 'Đúng / Sai' },
            { id: 'poll', label: '📊 Bình chọn' },
            { id: 'word_cloud', label: '☁️ Word Cloud' },
            { id: 'rating', label: '⭐ Đánh giá' },
            { id: 'open_text', label: '✍️ Tự luận' },
          ] as Array<{ id: QuestionType; label: string }>
        ).map((item) => {
          const active = (question.questionType ?? 'multiple_choice') === item.id;
          return (
            <Pressable
              key={item.id}
              disabled={busy}
              accessibilityRole="button"
              onPress={() =>
                updateQuestion(question.id, (current) => ({
                  ...current,
                  questionType: item.id,
                  multiSelect: item.id === 'multiple_choice' ? current.multiSelect : false,
                  options:
                    item.id === 'true_false'
                      ? [language === 'vi' ? 'Đúng' : 'True', language === 'vi' ? 'Sai' : 'False']
                      : item.id === 'word_cloud' || item.id === 'rating' || item.id === 'open_text'
                        ? []
                        : current.options.length === 4
                          ? current.options
                          : ['', '', '', ''],
                  correctIndex: item.id === 'true_false' ? Math.min(current.correctIndex, 1) : current.correctIndex,
                  ratingMax: item.id === 'rating' ? (current.ratingMax ?? 5) : current.ratingMax,
                }))
              }
              style={[
                styles.typeChip,
                {
                  backgroundColor: active ? palette.indigo : palette.paper,
                  borderColor: active ? palette.indigo : palette.paperMuted,
                },
              ]}
            >
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: active ? '#FFFFFF' : palette.inkMuted }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {(question.questionType ?? 'multiple_choice') === 'multiple_choice' && (
        <Pressable
          disabled={busy}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: Boolean(question.multiSelect) }}
          onPress={() =>
            updateQuestion(question.id, (current) => ({
              ...current,
              multiSelect: !current.multiSelect,
              correctIndices: !current.multiSelect
                ? Array.from(new Set([current.correctIndex, ...(current.correctIndices ?? [])]))
                : undefined,
            }))
          }
          style={[styles.codeToggle, { borderColor: question.multiSelect ? palette.indigo : palette.paperMuted, backgroundColor: question.multiSelect ? palette.indigoTint : palette.paper }]}
        >
          <Ionicons name={question.multiSelect ? 'checkbox' : 'square-outline'} size={16} color={palette.indigo} />
          <Text style={[typography.caption, { color: palette.indigo, fontWeight: '700' }]}>
            {language === 'vi' ? 'Cho phép nhiều đáp án đúng (Multi-select)' : 'Allow multiple correct answers'}
          </Text>
        </Pressable>
      )}
      {question.questionType === 'rating' && (
        <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
          {([5, 10] as const).map((max) => (
            <Pressable
              key={max}
              disabled={busy}
              onPress={() => updateQuestion(question.id, (current) => ({ ...current, ratingMax: max }))}
              style={[
                styles.typeChip,
                {
                  backgroundColor: (question.ratingMax ?? 5) === max ? palette.goldTint : palette.paper,
                  borderColor: (question.ratingMax ?? 5) === max ? palette.gold : palette.paperMuted,
                },
              ]}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: (question.ratingMax ?? 5) === max ? palette.gold : palette.inkMuted }}>
                {max === 5 ? '⭐ Thang 5 sao' : '🔟 Thang điểm 1–10'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {(question.questionType === 'word_cloud' || question.questionType === 'open_text') && (
        <Text style={[typography.caption, { color: palette.inkMuted }]}>
          {question.questionType === 'word_cloud'
            ? '☁️ Người chơi sẽ nhập tối đa 3 từ khóa ngắn để ghép thành Đám mây từ khóa (không chấm điểm).'
            : '✍️ Người chơi sẽ nhập câu trả lời tự luận ngắn (hỗ trợ chế độ ẩn danh, không chấm điểm).'}
        </Text>
      )}
      <TextInput testID={`question-${index}-content`} editable={!busy} accessibilityLabel={`${t.home.questionLabel} ${index + 1}`} placeholder={t.home.questionLabel} value={question.content} onChangeText={(content) => updateQuestion(question.id, (current) => ({ ...current, content }))} multiline textAlignVertical="top" style={[styles.questionInput, { color: palette.ink, borderColor: palette.paperMuted }]} />
      <Pressable
        disabled={busy}
        accessibilityRole="button"
        onPress={() => setOpenCodeIds((prev) => ({ ...prev, [question.id]: !(prev[question.id] ?? Boolean(question.codeSnippet)) }))}
        style={[styles.codeToggle, { borderColor: palette.paperMuted, backgroundColor: palette.paper }]}
      >
        <Ionicons name="code-slash-outline" size={16} color={palette.indigo} />
        <Text style={[typography.caption, { color: palette.indigo, fontWeight: '700' }]}>
          {(openCodeIds[question.id] ?? Boolean(question.codeSnippet))
            ? (language === 'vi' ? 'Ẩn đoạn code minh hoạ' : 'Hide code snippet')
            : (language === 'vi' ? 'Thêm đoạn code minh hoạ (tuỳ chọn)' : 'Add code snippet (optional)')}
        </Text>
      </Pressable>
      {(openCodeIds[question.id] ?? Boolean(question.codeSnippet)) && (
        <TextInput
          testID={`question-${index}-code`}
          editable={!busy}
          accessibilityLabel={`Code snippet ${index + 1}`}
          value={question.codeSnippet ?? ''}
          onChangeText={(codeSnippet) => updateQuestion(question.id, (current) => ({ ...current, codeSnippet: codeSnippet || undefined }))}
          placeholder="// Ví dụ: const sum = (a, b) => a + b;"
          placeholderTextColor="#64748B"
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
          style={styles.codeInput}
        />
      )}
      {question.options.map((option, optionIndex) => {
        const isMarked = question.multiSelect
          ? (question.correctIndices ?? [question.correctIndex]).includes(optionIndex)
          : question.correctIndex === optionIndex;
        return (
          <View key={`${question.id}-${optionIndex}`} style={styles.optionRow}>
            {question.questionType !== 'poll' && (
              <Pressable
                disabled={busy}
                accessibilityRole={question.multiSelect ? 'checkbox' : 'radio'}
                accessibilityState={{ selected: isMarked, checked: isMarked }}
                accessibilityLabel={`Mark option ${optionIndex + 1} as correct`}
                onPress={() =>
                  updateQuestion(question.id, (current) => {
                    if (!current.multiSelect) return { ...current, correctIndex: optionIndex };
                    const cur = current.correctIndices ?? [current.correctIndex];
                    const nextSet = cur.includes(optionIndex)
                      ? cur.length > 1
                        ? cur.filter((v) => v !== optionIndex)
                        : cur
                      : [...cur, optionIndex];
                    return { ...current, correctIndex: nextSet[0] ?? 0, correctIndices: nextSet };
                  })
                }
                style={[styles.answerMark, { backgroundColor: isMarked ? palette.mintTint : palette.paperMuted }]}
              >
                <Ionicons
                  name={question.multiSelect ? (isMarked ? 'checkbox' : 'square-outline') : isMarked ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={isMarked ? palette.mint : palette.inkMuted}
                />
              </Pressable>
            )}
            <TextInput
              testID={`question-${index}-option-${optionIndex}`}
              editable={!busy}
              accessibilityLabel={`${t.home.optionLabel} ${optionIndex + 1}`}
              placeholder={`${t.home.optionLabel} ${optionIndex + 1}`}
              value={option}
              onChangeText={(nextOption) =>
                updateQuestion(question.id, (current) => ({
                  ...current,
                  options: current.options.map((value, currentIndex) => (currentIndex === optionIndex ? nextOption : value)),
                }))
              }
              style={[styles.optionInput, { color: palette.ink, borderColor: palette.paperMuted }]}
            />
          </View>
        );
      })}
      <TextInput testID={`question-${index}-explanation`} editable={!busy} accessibilityLabel="Explanation" value={question.explanation} onChangeText={(explanation) => updateQuestion(question.id, (current) => ({ ...current, explanation }))} placeholder="Add an explanation" placeholderTextColor={palette.inkMuted} multiline style={[styles.explanationInput, { color: palette.ink, borderColor: palette.paperMuted }]} />
    </Card>)}

    {busy && queueJobs.some(job => job.id === selectedJobId && job.status === 'running') && <Button variant="secondary" onPress={() => {
      const job = jobs.find(item => item.id === generation.current?.id);
      if (job) void cancelJob(job);
    }}>{language === 'vi' ? 'Hủy tạo câu hỏi' : 'Cancel generation'}</Button>}
    <View style={styles.actions}>
      {!manualMode && <Button testID="generate-from-source" variant="secondary" onPress={() => void generate()} disabled={!canGenerate}>{busy ? (language === 'vi' ? 'Đang tạo…' : 'Generating…') : (language === 'vi' ? 'Tạo từ tài liệu đã xem' : 'Generate from reviewed source')}</Button>}
      <Button testID="save-question-set" icon="checkmark" onPress={() => void save()} disabled={busy || questions.length === 0}>{busy ? (language === 'vi' ? 'Đang xử lý…' : 'Working…') : existingSet ? t.home.saveChanges : manualMode ? t.home.saveSet : partial
        ? (language === 'vi' ? `Lưu ${validCount} câu đã duyệt` : `Save ${validCount} reviewed questions`)
        : (language === 'vi' ? 'Lưu bộ câu hỏi' : 'Save question set')}</Button>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  controls: { padding: spacing.xl, gap: spacing.md },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  question: { marginBottom: spacing.md, gap: spacing.sm },
  queueCard: { marginTop: spacing.xl, gap: spacing.md },
  jobRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  questionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs },
  questionActions: { flexDirection: 'row' },
  typeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 2 },
  typeChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  questionInput: { minHeight: 62, borderWidth: 1, borderRadius: 12, padding: spacing.md, fontSize: 16, lineHeight: 22 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  answerMark: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  removeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  optionInput: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, fontSize: 14 },
  explanationInput: { minHeight: 48, borderWidth: 1, borderRadius: 12, padding: spacing.md, fontSize: 14 },
  codeToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  codeInput: { minHeight: 84, borderRadius: 10, padding: spacing.md, backgroundColor: '#0F172A', color: '#E2E8F0', fontFamily: 'monospace', fontSize: 13, lineHeight: 20 },
  actions: { gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.xl },
});
