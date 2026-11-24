import { AppError, errorMessage, serviceFailure } from '@/core/domain/failure';
import { supabase } from '@/core/network/supabase';
import type { AppUser, UserRole } from '@/core/domain/models';
import type { AuthProvider, AuthRepository } from '../domain/repository';

const VALID_ROLES = new Set<UserRole>(['user', 'moderator', 'admin', 'superadmin']);

function normalizeRole(value: unknown): UserRole {
  return typeof value === 'string' && VALID_ROLES.has(value as UserRole)
    ? (value as UserRole)
    : 'user';
}

function mapUser(
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
  } | null,
  profileOverride?: { display_name?: string | null; avatar_url?: string | null; role?: string | null }
): AppUser | null {
  if (!user) return null;
  const displayName =
    (typeof profileOverride?.display_name === 'string' && profileOverride.display_name.trim()) ||
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()) ||
    (typeof user.user_metadata?.display_name === 'string' && user.user_metadata.display_name.trim()) ||
    (user.email ? user.email.split('@')[0] : 'Learner');

  const avatarUrl =
    (typeof profileOverride?.avatar_url === 'string' && profileOverride.avatar_url.trim()) ||
    (typeof user.user_metadata?.avatar_url === 'string' && user.user_metadata.avatar_url.trim()) ||
    (typeof user.user_metadata?.picture === 'string' && user.user_metadata.picture.trim()) ||
    null;

  const role = normalizeRole(
    profileOverride?.role ?? user.app_metadata?.role ?? user.user_metadata?.role
  );

  return {
    id: user.id,
    email: user.email,
    displayName: displayName || 'Learner',
    avatarUrl,
    role,
  };
}

async function hydrateProfileFields(
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
  } | null
): Promise<AppUser | null> {
  if (!user) return null;
  if (!supabase) return mapUser(user);
  try {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, role')
      .eq('id', user.id)
      .maybeSingle();
    return mapUser(
      user,
      (data as { display_name?: string | null; avatar_url?: string | null; role?: string | null } | null) ?? undefined
    );
  } catch {
    return mapUser(user);
  }
}

function getWebRedirectUrl(pathname: string): string | undefined {
  if (typeof window === 'undefined' || !window.location?.origin) return undefined;
  return `${window.location.origin}${pathname}`;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return hydrateProfileFields(data.session?.user ?? null);
}

export async function signOut(): Promise<void> {
  if (supabase) await supabase.auth.signOut();
}

export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured. You can still use guest study.';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? errorMessage(serviceFailure(error.status)) : null;
}

export async function signUpWithPassword(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured.';
  const emailRedirectTo = getWebRedirectUrl('/auth');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });
  if (error) {
    if (error.message.includes('rate limit')) {
      return 'Email delivery is temporarily limited. Please wait before trying again.';
    }
    return errorMessage(serviceFailure(error.status));
  }
  if (data.user && !data.session) {
    return 'CONFIRM_EMAIL_REQUIRED';
  }
  return null;
}

export async function resetPasswordForEmail(email: string): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured.';
  const redirectTo = getWebRedirectUrl('/auth');
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) {
    if (error.message.includes('rate limit')) {
      return 'Email rate limit exceeded. Please wait a few minutes before trying again.';
    }
    return errorMessage(serviceFailure(error.status));
  }
  return null;
}

export async function updatePassword(newPassword: string): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured.';
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return errorMessage(serviceFailure(error.status));
  }
  return null;
}

export async function startOAuth(provider: AuthProvider): Promise<{ url?: string; error?: string }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const redirectTo = getWebRedirectUrl('/');
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
    return { error: errorMessage(serviceFailure(error.status)) };
  }
  return { url: data.url ?? undefined };
}

export function onAuthStateChange(listener: (user: AppUser | null, event?: string) => void): () => void {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const baseUser = mapUser(session?.user ?? null);
    listener(baseUser, event);
    if (session?.user) {
      void hydrateProfileFields(session.user).then((enriched) => {
        if (enriched) listener(enriched, event);
      });
    }
  });
  return () => {
    data.subscription.unsubscribe();
  };
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

export async function updateDisplayName(name: string): Promise<AppUser> {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 60) {
    throw new AppError('unavailable', 'Tên cần từ 2 đến 60 ký tự.');
  }
  if (!supabase) throw new AppError('unavailable', 'Bạn cần đăng nhập trước.');
  const { data, error } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
  if (error) throw new AppError('unavailable', 'Không lưu được hồ sơ. Kiểm tra kết nối rồi thử lại.');
  if (data.user?.id) {
    await supabase
      .from('profiles')
      .upsert({ id: data.user.id, display_name: trimmed }, { onConflict: 'id' })
      .then(() => undefined, () => undefined);
  }
  const user = await hydrateProfileFields(data.user);
  if (!user) throw new AppError('unavailable', 'Vui lòng đăng nhập lại.');
  return user;
}

export async function updateUserAvatar(avatarUrl: string): Promise<AppUser> {
  const trimmed = avatarUrl.trim();
  if (!trimmed || trimmed.length > 180_000) {
    throw new AppError('validation', 'Ảnh đại diện quá lớn hoặc không hợp lệ.');
  }
  if (!supabase) throw new AppError('unavailable', 'Bạn cần đăng nhập để đổi ảnh đại diện.');
  const { data, error } = await supabase.auth.updateUser({ data: { avatar_url: trimmed } });
  if (error) throw new AppError('unavailable', 'Không cập nhật được ảnh đại diện lúc này.');
  if (data.user?.id) {
    await supabase
      .from('profiles')
      .upsert({ id: data.user.id, avatar_url: trimmed }, { onConflict: 'id' })
      .then(() => undefined, () => undefined);
  }
  const user = await hydrateProfileFields(data.user);
  if (!user) throw new AppError('unavailable', 'Vui lòng đăng nhập lại.');
  return user;
}
