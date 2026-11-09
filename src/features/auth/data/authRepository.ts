import { supabase } from '@/core/network/supabase';
import type { AppUser } from '@/core/domain/models';
import type { AuthProvider, AuthRepository } from '../domain/repository';

function mapUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null): AppUser | null {
  return user ? { id: user.id, email: user.email, displayName: typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : 'Learner' } : null;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return mapUser(data.session?.user ?? null);
}

export async function signOut(): Promise<void> {
  if (supabase) await supabase.auth.signOut();
}

export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error?.message ?? null;
}

export async function startOAuth(provider: AuthProvider): Promise<{ url?: string; error?: string }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { data, error } = await supabase.auth.signInWithOAuth({ provider });
  return error ? { error: error.message } : { url: data.url ?? undefined };
}

export function onAuthStateChange(listener: (user: AppUser | null) => void): () => void {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(mapUser(session?.user ?? null)));
  return () => { data.subscription.unsubscribe(); };
}

export const authRepository: AuthRepository = {
  getCurrentUser,
  signInWithPassword,
  startOAuth,
  signOut,
  onAuthStateChange,
};
