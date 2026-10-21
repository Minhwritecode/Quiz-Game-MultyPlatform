import { supabase } from '@/core/network/supabase';
import type { AppUser } from '@/core/domain/models';

export async function getCurrentUser(): Promise<AppUser | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  return user ? { id: user.id, email: user.email, displayName: (user.user_metadata?.display_name as string | undefined) ?? 'Learner' } : null;
}

export async function signOut(): Promise<void> {
  if (supabase) await supabase.auth.signOut();
}

export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error?.message ?? null;
}
