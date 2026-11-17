import { seedQuestionSets } from '@/core/data/seed';
import { cloudSets } from '@/features/sync/data/cloudSets';
import { learningSync } from '@/features/sync/data/learningSync';
import { questionSetRepository } from '@/features/question-sets/data/persistence';
import { studyRepository } from '@/features/study/data/persistence';
import { deviceLearning } from '@/features/sync/data/deviceLearning';
import { createAccountRepositories } from '@/features/sync/domain/accountRepositories';
import { canSync, observeSyncWake } from '@/features/sync/data/connectivity';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { errorMessage } from '@/core/domain/failure';

const owner = () => useAuthStore.getState().user?.id ?? null;
let notify = () => {};
const guestSets = {...questionSetRepository, async list() {
  const stored=await questionSetRepository.list(), deleted=usePapyrusStore.getState().deletedSetIds;
  return [...stored,...seedQuestionSets.filter(seed=>!stored.some(s=>s.id===seed.id)&&!deleted.includes(seed.id))];
}};
export const accountRepositories = createAccountRepositories(owner, cloudSets, learningSync, guestSets, studyRepository, deviceLearning, () => notify());
let running: Promise<void> | null = null;
let refreshVersion = 0;
async function refresh() {
  const account = owner(), version = ++refreshVersion;
  const sets = await accountRepositories.questionSets.list();
  if (owner() === account && version === refreshVersion) usePapyrusStore.getState().replaceQuestionSets(sets);
}
async function syncNow() {
  if (running) return running;
  const account = owner();
  running = (async () => {
    await refresh();
    if (!account || !(await canSync()) || owner() !== account) return;
    try {
      await cloudSets.sync(account);
      if (owner() === account) { await learningSync.sync(account); usePapyrusStore.getState().setSyncMessage(''); }
    } finally { if (owner() === account) await refresh(); }
  })().finally(() => { running = null; });
  return running;
}
export const learning = {
  ...accountRepositories,
  guestSets,
  cloud: learningSync,
  refresh,
  syncNow,
  start() {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      if (disposed) return;
      clearTimeout(timer);
      void syncNow().catch(error => {
        if (!disposed) usePapyrusStore.getState().setSyncMessage(errorMessage(error, 'Chưa đồng bộ được. Dữ liệu vẫn được giữ trên thiết bị.'));
      }).finally(() => { if (!disposed) timer = setTimeout(wake, 30000); });
    };
    notify = () => { void refresh().then(wake).catch(() => wake()); };
    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (state.user?.id !== previous.user?.id || state.status !== previous.status) {
        ++refreshVersion;
        usePapyrusStore.getState().resetAccountView();
        void refresh().catch(() => undefined);
        void (running ?? Promise.resolve()).finally(wake).catch(() => undefined);
      }
    });
    const stopSignals = observeSyncWake(wake);
    wake();
    return () => { disposed = true; notify = () => {}; clearTimeout(timer); unsubscribe(); stopSignals(); };
  },
};
