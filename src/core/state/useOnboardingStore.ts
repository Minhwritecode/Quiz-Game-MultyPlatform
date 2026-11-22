import { create } from 'zustand';
import { dependencies } from '@/composition/dependencies';
import { shouldAutoShowOnboarding } from '@/features/onboarding/domain/onboardingState';

type OnboardingStoreState = {
  visible: boolean;
  replayMode: boolean;
  activeUserId: string | null;
  checkedUsers: Record<string, true>;
  checkAndTriggerForUser: (userId: string) => Promise<void>;
  openReplay: () => void;
  dismiss: () => void;
};

export const useOnboardingStore = create<OnboardingStoreState>((set, get) => ({
  visible: false,
  replayMode: false,
  activeUserId: null,
  checkedUsers: {},

  checkAndTriggerForUser: async (userId: string) => {
    const cleanId = userId.trim();
    if (!cleanId) return;
    if (get().checkedUsers[cleanId]) return;

    set((state) => ({
      checkedUsers: { ...state.checkedUsers, [cleanId]: true },
    }));

    const hasSeen = await dependencies.onboarding.hasSeenIntro(cleanId);
    const shouldShow = shouldAutoShowOnboarding({
      userId: cleanId,
      hasSeen,
      isTestEnv: process.env.NODE_ENV === 'test',
    });

    if (shouldShow) {
      set({ visible: true, replayMode: false, activeUserId: cleanId });
    }
  },

  openReplay: () => {
    set({ visible: true, replayMode: true });
  },

  dismiss: () => {
    const { activeUserId, replayMode } = get();
    set({ visible: false, replayMode: false });
    if (activeUserId && !replayMode) {
      void dependencies.onboarding.markIntroSeen(activeUserId);
    }
  },
}));
