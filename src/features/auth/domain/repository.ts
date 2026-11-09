import type { AppUser } from '@/core/domain/models';

export type AuthProvider = 'google' | 'apple';

export interface AuthRepository {
  getCurrentUser(): Promise<AppUser | null>;
  signInWithPassword(email: string, password: string): Promise<string | null>;
  startOAuth(provider: AuthProvider): Promise<{ url?: string; error?: string }>;
  signOut(): Promise<void>;
  onAuthStateChange(listener: (user: AppUser | null) => void): () => void;
}
