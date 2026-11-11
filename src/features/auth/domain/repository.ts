import type { AppUser } from '@/core/domain/models';

export type AuthProvider = 'google' | 'facebook' | 'apple';

export interface AuthRepository {
  getCurrentUser(): Promise<AppUser | null>;
  signInWithPassword(email: string, password: string): Promise<string | null>;
  signUpWithPassword(email: string, password: string): Promise<string | null>;
  resetPasswordForEmail(email: string): Promise<string | null>;
  updatePassword(newPassword: string): Promise<string | null>;
  startOAuth(provider: AuthProvider): Promise<{ url?: string; error?: string }>;
  signOut(): Promise<void>;
  onAuthStateChange(listener: (user: AppUser | null, event?: string) => void): () => void;
}
