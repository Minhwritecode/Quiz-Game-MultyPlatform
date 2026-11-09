import { create } from 'zustand';
import type { AppUser } from '@/core/domain/models';
import type { AuthRepository } from '@/features/auth/domain/repository';

type AuthState = {
  status: 'unknown' | 'guest' | 'authenticated';
  user: AppUser | null;
  bootstrap: (repository: AuthRepository) => Promise<void>;
  setUser: (user: AppUser | null) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,
  bootstrap: async (repository) => {
    const user = await repository.getCurrentUser();
    set({ user, status: user ? 'authenticated' : 'guest' });
    repository.onAuthStateChange((nextUser) => set({ user: nextUser, status: nextUser ? 'authenticated' : 'guest' }));
  },
  setUser: (user) => set({ user, status: user ? 'authenticated' : 'guest' }),
  clear: () => set({ user: null, status: 'guest' }),
}));
