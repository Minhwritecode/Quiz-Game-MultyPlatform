import { create } from 'zustand';
import type { AppUser } from '@/core/domain/models';
import type { AuthRepository } from '@/features/auth/domain/repository';

type AuthState = {
  status: 'unknown' | 'guest' | 'authenticated';
  user: AppUser | null;
  guestEntered: boolean;
  bootstrap: (repository: AuthRepository) => Promise<void>;
  setUser: (user: AppUser | null) => void;
  enterGuestMode: () => void;
  clear: () => void;
};

let authUnsubscribe: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,
  guestEntered: false,
  bootstrap: async (repository) => {
    // Subscribe first so TOKEN_REFRESHED / INITIAL_SESSION events are never missed
    if (authUnsubscribe) {
      authUnsubscribe();
      authUnsubscribe = null;
    }
    let resolvedBootstrap = false;
    authUnsubscribe = repository.onAuthStateChange((nextUser, event) => {
      if (nextUser) {
        set({ user: nextUser, status: 'authenticated' });
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, status: 'guest', guestEntered: false });
      } else if (resolvedBootstrap) {
        set((prev) => (prev.user ? prev : { user: null, status: 'guest' }));
      }
    });

    try {
      const user = await repository.getCurrentUser();
      resolvedBootstrap = true;
      set((prev) => {
        if (user) return { user, status: 'authenticated' };
        // Never downgrade if onAuthStateChange already resolved a valid session
        if (prev.status === 'authenticated' && prev.user) return prev;
        return { user: null, status: 'guest' };
      });
    } catch {
      resolvedBootstrap = true;
      set((prev) => (prev.user ? prev : { user: null, status: 'guest' }));
    }
  },
  setUser: (user) =>
    set((prev) => ({
      user,
      status: user ? 'authenticated' : 'guest',
      guestEntered: user ? false : prev.guestEntered,
    })),
  enterGuestMode: () => set({ guestEntered: true }),
  clear: () => set({ user: null, status: 'guest', guestEntered: false }),
}));
