import { supabase } from '@/core/network/supabase';
import type { AppUser } from '@/core/domain/models';
import type { AuthProvider, AuthRepository } from '../domain/repository';

function mapUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null): AppUser | null {
  if (!user) return null;
  const displayName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()) ||
    (typeof user.user_metadata?.display_name === 'string' && user.user_metadata.display_name.trim()) ||
    (user.email ? user.email.split('@')[0] : 'Learner');

  return {
    id: user.id,
    email: user.email,
    displayName: displayName || 'Learner',
  };
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
  if (!supabase) return 'Supabase is not configured. You can still use guest study.';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error?.message ?? null;
}

export async function signUpWithPassword(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured.';
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    if (error.message.includes('rate limit')) {
      return 'Email delivery is temporarily limited. Please wait before trying again.';
    }
    return error.message;
  }
  if (data.user && !data.session) {
    return 'CONFIRM_EMAIL_REQUIRED';
  }
  return null;
}

export async function resetPasswordForEmail(email: string): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured.';
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) {
    if (error.message.includes('rate limit')) {
      return 'Email rate limit exceeded. Please wait a few minutes before trying again.';
    }
    return error.message;
  }
  return null;
}

export async function updatePassword(newPassword: string): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured.';
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return error.message;
  }
  return null;
}

export async function startOAuth(provider: AuthProvider): Promise<{ url?: string; error?: string }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
    },
  });
  if (error) {
    if (error.message.includes('not enabled') || error.message.includes('validation_failed')) {
      return {
        error: `PROVIDER_NOT_ENABLED:${provider}`,
      };
    }
    return { error: error.message };
  }
  return { url: data.url ?? undefined };
}

export function onAuthStateChange(listener: (user: AppUser | null, event?: string) => void): () => void {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((event, session) => listener(mapUser(session?.user ?? null), event));
  return () => { data.subscription.unsubscribe(); };
}

export const authRepository: AuthRepository = {
  getCurrentUser,
  signInWithPassword,
  signUpWithPassword,
  resetPasswordForEmail,
  updatePassword,
  startOAuth,
  signOut,
  onAuthStateChange,
};
