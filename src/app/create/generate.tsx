import { useAuthStore } from '@/core/state/useAuthStore';
import { randomUUID } from 'expo-crypto';
import { errorMessage } from '@/core/domain/failure';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, PageHeader, Screen, TopBar, usePalette } from '@/shared/ui';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { dependencies } from '@/composition/dependencies';
import { saveQuestionSet } from '@/features/question-sets/domain/saveQuestionSet';
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

const displayQuestions = (job: GenerationJob) => {
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
  const params = useLocalSearchParams<{ mode?: string; setId?: string }>();
  return <GenerationEditor key={account + ':' + (params.setId ?? '') + ':' + (params.mode ?? '')} />;
}

function GenerationEditor() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; setId?: string }>();
  const manualMode = params.mode === 'manual';
  const existingSet = usePapyrusStore((state) => state.questionSets.find((item) => item.id === params.setId));
  const { language, t } = useI18n();
  const [title,setTitle]=useState(existingSet?.title ?? '');
  const [subject,setSubject]=useState(existingSet?.subject ?? '');
  const [tagText,setTagText]=useState((existingSet?.tags ?? []).join(', '));
  const [message,setMessage]=useState('');
  const palette = usePalette();
  const saveToStore = usePapyrusStore((state) => state.saveQuestionSet);
  const sourceDocument = usePapyrusStore((state) => state.sourceDocument);
  const [sourceText, setSourceText] = useState(sourceDocument?.text ?? '');
  const [sourceDocumentId, setSourceDocumentId] = useState<string | null>(existingSet?.sourceDocumentId ?? sourceDocument?.id ?? null);
  const [sourceTitle, setSourceTitle] = useState(sourceDocument?.title ?? '');
  const [questions, setQuestions] = useState<Question[]>(() => existingSet?.questions ?? (manualMode ? [{ id: createLocalId(), content: '', options: ['', '', '', ''], correctIndex: 0, explanation: '', position: 0 }] : []));
  const [openCodeIds, setOpenCodeIds] = useState<Record<string, boolean>>({});
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Balanced' | 'Challenge'>('Balanced');
  const [busy, setBusy] = useState(false);
  const [jobs,setJobs]=useState<GenerationJob[]>([]);
  const generation = useRef<AbortController | null>(null);
  const activeJob = useRef<string | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const account = useAuthStore(state => state.user?.id ?? null);

  const refreshJobs = useCallback(async (owner: string) => {
    const next = await dependencies.generation.jobs.list(owner);
    if (mounted.current && useAuthStore.getState().user?.id === owner) setJobs(next);
    return next;
  }, []);

  const runJob = useCallback(async (jobId: string, owner: string) => {
    if (running.current || useAuthStore.getState().user?.id !== owner) return;
    running.current = true;
    const controller = new AbortController();
    generation.current = controller;
    try {
      const before = (await dependencies.generation.jobs.list(owner)).find(item => item.id === jobId);
      if (!before || ['completed','cancelled'].includes(before.status)) return;
      if (!(await dependencies.generation.online()) || controller.signal.aborted || useAuthStore.getState().user?.id !== owner) return;
      activeJob.current = jobId;
      const runningJob = await dependencies.generation.jobs.markRunning(owner, jobId);
      if (!runningJob) return;
      if (mounted.current) {
        setBusy(true);
        setTitle(runningJob.metadata.title); setSubject(runningJob.metadata.subject);
        setTagText(runningJob.metadata.tags.join(', '));
        setCount(runningJob.replaceQuestionId ? runningJob.initialQuestions.length : runningJob.initialQuestions.length + runningJob.request.questionCount);
        setSourceText(runningJob.request.sourceText); setSourceDocumentId(runningJob.metadata.sourceDocumentId);
        setSourceTitle(runningJob.metadata.sourceDocumentTitle);
        setQuestions(displayQuestions(runningJob));
        setMessage(language === 'vi' ? 'Đang nhận câu hỏi hợp lệ…' : 'Receiving valid questions…');
      }
      await refreshJobs(owner);
      const missing = Math.max(0, runningJob.request.questionCount - runningJob.questions.length);
      if (missing === 0) {
        await dependencies.generation.jobs.complete(owner, jobId);
      } else {
        const excluded = [...(runningJob.request.excludeQuestions ?? []),
          ...runningJob.initialQuestions.filter(item => item.id !== runningJob.replaceQuestionId).map(item => item.content),
          ...runningJob.questions.map(item => item.content)];
        const response = await dependencies.generation.generate({
          ...runningJob.request, questionCount: missing,
          excludeQuestions: [...new Set(excluded)].slice(0, 30),
        }, {
          requestId: runningJob.requestId,
          signal: controller.signal,
          onQuestion: async question => {
            if (useAuthStore.getState().user?.id !== owner || controller.signal.aborted) return;
            await dependencies.generation.jobs.appendQuestion(owner, jobId, question);
            const current = (await dependencies.generation.jobs.list(owner)).find(item => item.id === jobId);
            if (current && mounted.current) setQuestions(displayQuestions(current));
            await refreshJobs(owner);
          },
        });
        if (controller.signal.aborted) return;
        const current = (await dependencies.generation.jobs.list(owner)).find(item => item.id === jobId);
        const actual = current?.questions.length ?? response.count;
        const replacementMissing = Boolean(runningJob.replaceQuestionId) && actual === 0;
        if (replacementMissing) {
          await dependencies.generation.jobs.fail(owner, jobId, language === 'vi'
            ? 'AI chưa tạo được câu thay thế hợp lệ. Hãy thử lại câu này.'
            : 'No valid replacement was generated. Retry this question.');
        } else await dependencies.generation.jobs.complete(owner, jobId);
        if (mounted.current && useAuthStore.getState().user?.id === owner) {
          const complete = actual >= runningJob.request.questionCount;
          setMessage(replacementMissing
            ? (language === 'vi' ? 'Chưa có câu thay thế hợp lệ; công việc đã lưu để bạn thử lại.' : 'No valid replacement yet; the job is saved for retry.')
            : complete
            ? (language === 'vi' ? 'Đã tạo xong câu hỏi. Hãy rà đáp án trước khi lưu.' : 'Questions generated. Review the answers before saving.')
            : (language === 'vi' ? 'AI trả về ' + actual + ' câu mới. Bấm “Tạo bù” để hoàn thành bộ đề.' : 'AI returned ' + actual + ' new questions. Use “Fill missing” to complete the set.'));
        }
      }
      await refreshJobs(owner);
    } catch (error) {
      const current = (await dependencies.generation.jobs.list(owner)).find(item => item.id === jobId);
      const interrupted = controller.signal.aborted && current && (!mounted.current || useAuthStore.getState().user?.id !== owner);
      if (interrupted) {
        await dependencies.generation.jobs.update(owner, jobId, job => job.status === 'cancelled'
          ? job : { ...job, status: 'queued', retryAt: 0, error: 'Interrupted; ready to resume.' });
      } else if (current) await dependencies.generation.jobs.fail(owner, jobId, errorMessage(error, 'Generation failed. Valid questions remain saved; retry when ready.'));
      await refreshJobs(owner);
      if (!interrupted && current && mounted.current && useAuthStore.getState().user?.id === owner) setMessage(errorMessage(error, 'Generation failed. Valid questions remain saved; retry when ready.'));
    } finally {
      if (activeJob.current === jobId) activeJob.current = null;
      generation.current = null;
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [language, refreshJobs]);

  const resumeNext = useCallback(async (owner: string) => {
    if (running.current || useAuthStore.getState().user?.id !== owner) return;
    const stored = await dependencies.generation.jobs.list(owner);
    const next = stored.find(job => ['queued','failed'].includes(job.status) && job.retryAt <= Date.now());
    if (next) {
      if (next.status === 'failed') await dependencies.generation.jobs.retry(owner,next.id);
      await runJob(next.id, owner);
    }
  }, [runJob]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const owner = useAuthStore.getState().user?.id;
      const jobId = activeJob.current;
      generation.current?.abort();
      if (owner && jobId) void dependencies.generation.jobs.update(owner, jobId, job => job.status === 'cancelled'
        ? job : { ...job, status: 'queued', retryAt: 0, error: 'Interrupted; ready to resume.' });
    };
  }, []);

  useEffect(() => {
    if (!existingSet?.sourceDocumentId || !account) return;
    let active = true;
    void dependencies.sources.list().then(documents => {
      const document = documents.find(item => item.id === existingSet.sourceDocumentId);
      if (active && document && useAuthStore.getState().user?.id === account) {
        setSourceText(document.text); setSourceDocumentId(document.id); setSourceTitle(document.title);
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [sourceDocument?.id, existingSet?.sourceDocumentId, account]);

  useEffect(() => {
    if (!account || manualMode) return;
    let active = true;
    void dependencies.generation.jobs.recover(account).then(items => {
      if (!active || useAuthStore.getState().user?.id !== account) return;
      setJobs(items);
      const latest = items[0];
      if (latest && !existingSet) {
        setTitle(latest.metadata.title); setSubject(latest.metadata.subject);
        setTagText(latest.metadata.tags.join(', ')); setCount(latest.replaceQuestionId ? latest.initialQuestions.length : latest.initialQuestions.length + latest.request.questionCount);
        setSourceText(latest.request.sourceText); setSourceDocumentId(latest.metadata.sourceDocumentId);
        setSourceTitle(latest.metadata.sourceDocumentTitle);
        setDifficulty(latest.request.difficulty === 'easy' ? 'Easy' : latest.request.difficulty === 'hard' ? 'Challenge' : 'Balanced');
        setQuestions(displayQuestions(latest));
        if (latest.status === 'failed') setMessage(latest.error ?? '');
      }
      void resumeNext(account);
    }).catch(() => setMessage('Could not restore the saved generation queue.'));
    const stop = dependencies.generation.observeWake(() => void resumeNext(account));
    const timer=setInterval(()=>void resumeNext(account),30000);
    return () => { active = false; stop(); clearInterval(timer); };
  }, [account, manualMode, existingSet?.id, resumeNext]);

  const startJob = async (request: GenerationRequest, initialQuestions: Question[] = [], replaceQuestionId?: string) => {
    if (manualMode || busy) return;
    if (!dependencies.generation.configured) {
      setMessage(language === 'vi' ? 'AI chưa được cấu hình. Bạn vẫn có thể tạo câu hỏi thủ công.' : 'AI is not configured. You can still write questions manually.');
      return;
    }
    if (!account) {
      setMessage(language === 'vi' ? 'Đăng nhập để xếp hàng và tạo câu hỏi AI.' : 'Sign in to queue and generate AI questions.');
      return;
    }
    if (!request.sourceText.trim()) {
      setMessage(language === 'vi' ? 'Hãy thêm tài liệu trước khi tạo câu hỏi.' : 'Add study material before generating questions.');
      return;
    }
    setMessage('');
    try {
    const metadata = { title: title.trim(), subject: subject.trim(), tags: tagValues(tagText), sourceDocumentId, sourceDocumentTitle: sourceTitle };
    const job = await dependencies.generation.jobs.enqueue(account, request, metadata, initialQuestions, replaceQuestionId);
    await refreshJobs(account);
    if (!(await dependencies.generation.online())) {
      setMessage(language === 'vi' ? 'Đang ngoại tuyến. Công việc đã lưu, app sẽ tiếp tục khi có mạng hoặc khi bạn mở lại màn này.' : 'Offline. Job saved and will resume when online or when you reopen this screen.');
      return;
    }
    void runJob(job.id, account);
    } catch (error) { setMessage(errorMessage(error, 'Could not save the generation job. Try again.')); }
  };

  const generate = () => startJob({
    sourceText, questionCount: count,
    difficulty: difficulty === 'Easy' ? 'easy' : difficulty === 'Challenge' ? 'hard' : 'medium',
    languageCode: language,
  });

  const fillMissing = () => {
    const missing = count - questions.length;
    if (missing <= 0) return;
    void startJob({
      sourceText, questionCount: missing,
      difficulty: difficulty === 'Easy' ? 'easy' : difficulty === 'Challenge' ? 'hard' : 'medium',
      languageCode: language, excludeQuestions: questions.map(item => item.content),
    }, questions);
  };

  const regenerate = (question: Question) => void startJob({
    sourceText, questionCount: 1,
    difficulty: difficulty === 'Easy' ? 'easy' : difficulty === 'Challenge' ? 'hard' : 'medium',
    languageCode: language, excludeQuestions: questions.filter(item => item.id !== question.id).map(item => item.content),
  }, questions, question.id);

  const retryJob = async (job: GenerationJob) => {
    if (!account) return;
    const next = await dependencies.generation.jobs.retry(account, job.id);
    await refreshJobs(account);
    if (next) void runJob(job.id, account);
  };

  const cancelJob = async (job: GenerationJob) => {
    if (!account) return;
    await dependencies.generation.jobs.remove(account, job.id);
    if (activeJob.current === job.id) generation.current?.abort();
    await refreshJobs(account);
    setMessage(language === 'vi' ? 'Đã hủy công việc tạo đề.' : 'Generation job cancelled.');
  };

  const updateQuestion = (questionId: string, update: (question: Question) => Question) => {
    setQuestions((current) => current.map((question) => question.id === questionId ? update(question) : question));
  };

  const removeQuestion = (questionId: string) => {
    setQuestions((current) => current.filter((question) => question.id !== questionId).map((question, position) => ({ ...question, position })));
  };

  const save = async () => {
    if (busy) return;
    if (!title.trim() || !subject.trim() || questions.length === 0 || questions.some((question) => !isValidQuestion(question))) {
      setMessage(manualMode ? t.home.saveError : 'Enter a title, subject, and complete all question options before saving.');
      return;
    }
    if (!manualMode && questions.length < count) {
      setMessage(language === 'vi' ? 'Hãy tạo bù đủ số câu đã chọn hoặc giảm số câu trước khi lưu.' : 'Fill the missing questions or lower the selected count before saving.');
      return;
    }
    setMessage('');
    setBusy(true);
    const owner=useAuthStore.getState().user?.id;
    const questionSet: QuestionSet = {
      id: existingSet?.id ?? createLocalId(), title: title.trim(), subject: subject.trim(),
      tags: tagValues(tagText), sourceDocumentId,
      updatedAt: new Date().toISOString(), syncStatus: 'pending', questions,
    };
    try {
      await saveQuestionSet(dependencies.questionSets, questionSet);
      if(useAuthStore.getState().user?.id!==owner)return;
      if (existingSet) await dependencies.study.clearProgress(existingSet.id);
      saveToStore(questionSet);
      if (owner) await dependencies.generation.jobs.clearCompleted(owner);
      router.replace('/sets');
    } catch (error) {
      setMessage(errorMessage(error, 'Could not save. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const queuedJobs = jobs.filter(job => ['queued','running','failed'].includes(job.status));
  return <Screen>
    <TopBar title={existingSet ? t.home.editSet : manualMode ? t.home.manualTitle : 'Shape your quiz'} />
    <PageHeader eyebrow={manualMode ? t.home.manualEyebrow : 'STEP 2 OF 3 · SHAPE'} title={existingSet ? t.home.editSet : manualMode ? t.home.manualTitle : 'Make the generation yours'} subtitle={manualMode ? t.home.manualSubtitle : 'Choose the output, review every answer and save only what you trust.'} />
    <Card style={styles.controls}>
      {!manualMode && <Text style={[typography.body,{color:palette.ink}]}>AI sends the text you reviewed to our generation provider. Images stay on this device. Check the answers before saving.</Text>}
      <TextInput testID="set-title" editable={!busy} accessibilityLabel="Question set title" placeholder={language === 'vi' ? 'Tên bộ câu hỏi' : 'Question set title'} value={title} onChangeText={setTitle} maxLength={160} style={[styles.questionInput,{color:palette.ink,borderColor:palette.paperMuted}]} />
      <TextInput testID="set-subject" editable={!busy} accessibilityLabel={t.home.subjectLabel} placeholder={t.home.subjectPlaceholder} value={subject} onChangeText={setSubject} maxLength={100} style={[styles.questionInput,{color:palette.ink,borderColor:palette.paperMuted}]} />
      <TextInput testID="set-tags" editable={!busy} accessibilityLabel={language === 'vi' ? 'Thẻ của bộ đề, cách nhau bằng dấu phẩy' : 'Question set tags, comma separated'} placeholder={language === 'vi' ? 'Thẻ: đại số, chương 2, ôn thi' : 'Tags: algebra, chapter 2, exam'} value={tagText} onChangeText={setTagText} maxLength={400} style={[styles.questionInput,{color:palette.ink,borderColor:palette.paperMuted}]} />
      {!manualMode && <Text style={[typography.caption,{color:palette.inkMuted}]}>{language === 'vi' ? 'Nguồn: ' : 'Source: '}{sourceTitle || (questions.length ? 'Restored from saved generation job' : 'No source attached')}</Text>}
      {message ? <Text accessibilityRole="alert" style={{color:palette.danger}}>{message}</Text> : null}
      {!manualMode && <>
        <Text style={[typography.title, { color: palette.ink }]}>Question count</Text>
        <View style={styles.choiceRow}>{[5, 10, 15].map((value) => <Button key={value} variant={count === value ? 'primary' : 'secondary'} onPress={() => setCount(value)} disabled={busy}>{String(value)}</Button>)}</View>
        <Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl }]}>Difficulty</Text>
        <View style={styles.choiceRow}>{(['Easy', 'Balanced', 'Challenge'] as const).map((value) => <Button key={value} variant={difficulty === value ? 'primary' : 'secondary'} onPress={() => setDifficulty(value)} disabled={busy}>{value}</Button>)}</View>
        <Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.lg }]}>{questions.length} / {count} ready · {difficulty} · {language === 'vi' ? 'Tiếng Việt' : 'English'}</Text>
      </>}
    </Card>

    {queuedJobs.length > 0 && <Card style={styles.queueCard}>
      <Text style={[typography.title, { color: palette.ink }]}>{language === 'vi' ? 'Hàng đợi tạo đề' : 'Generation queue'}</Text>
      {queuedJobs.map(job => <View key={job.id} style={styles.jobRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.label, { color: palette.ink }]}>{job.metadata.title || (language === 'vi' ? 'Bộ đề chưa đặt tên' : 'Untitled question set')}</Text>
          <Text style={[typography.caption, { color: palette.inkMuted }]}>{job.status} · {job.questions.length}/{job.request.questionCount} · attempt {job.attempt}</Text>
        </View>
        {job.status !== 'running' && <Button variant="secondary" onPress={() => void retryJob(job)}>{language === 'vi' ? 'Thử lại' : 'Retry'}</Button>}
        <Pressable accessibilityRole="button" accessibilityLabel={language === 'vi' ? 'Hủy công việc' : 'Cancel job'} onPress={() => void cancelJob(job)} style={styles.removeButton}><Ionicons name="close-circle-outline" size={22} color={palette.danger} /></Pressable>
      </View>)}
    </Card>}

    <Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl, marginBottom: spacing.md }]}>{manualMode ? t.home.correctAnswerHint : 'Review before saving'}</Text>
    {questions.length === 0 && <Card><Text style={[typography.body, { color: palette.inkMuted }]}>No questions yet. Generate from your saved source or write them manually.</Text></Card>}
    {!manualMode && questions.length > 0 && questions.length < count && <Button variant="secondary" disabled={busy} onPress={fillMissing}>{language === 'vi' ? 'Tạo bù ' + (count - questions.length) + ' câu còn thiếu' : 'Fill ' + (count - questions.length) + ' missing questions'}</Button>}
    <Button variant="secondary" disabled={busy || questions.length >= 30} onPress={() => setQuestions(current => [...current, { id: createLocalId(), content: '', options: ['', '', '', ''], correctIndex: 0, explanation: '', position: current.length }])}>{t.home.addQuestion}</Button>
    {questions.map((question, index) => <Card key={question.id || `question-${index}`} style={styles.question}>
      <View style={styles.questionHeader}>
        <Text style={[typography.label, { color: palette.indigo }]}>{t.home.questionLabel.toLocaleUpperCase()} {index + 1}</Text>
        <View style={styles.questionActions}>
          {!manualMode && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={(language === 'vi' ? 'Sinh lại câu ' : 'Regenerate question ') + (index + 1)}
              disabled={busy || !sourceText}
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeScroll}>
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
              <Text style={{ fontSize: 11, fontWeight: '700', color: active ? '#FFFFFF' : palette.inkMuted }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
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

    {busy && queuedJobs.some(job => job.status === 'running') && <Button variant="secondary" onPress={() => {
      const job = jobs.find(item => item.id === activeJob.current);
      if (job) void cancelJob(job);
    }}>{language === 'vi' ? 'Hủy tạo câu hỏi' : 'Cancel generation'}</Button>}
    <View style={styles.actions}>
      {!manualMode && <Button testID="generate-from-source" variant="secondary" onPress={() => void generate()} disabled={busy}>{busy ? (language === 'vi' ? 'Đang tạo…' : 'Generating…') : (language === 'vi' ? 'Tạo từ tài liệu đã xem' : 'Generate from reviewed source')}</Button>}
      <Button testID="save-question-set" icon="checkmark" onPress={() => void save()} disabled={busy || questions.length === 0}>{busy ? 'Saving…' : existingSet ? t.home.saveChanges : manualMode ? t.home.saveSet : 'Save question set'}</Button>
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
  typeScroll: { gap: 6, paddingVertical: 2 },
  typeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
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
