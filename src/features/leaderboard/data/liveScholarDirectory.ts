import { supabase } from '@/core/network/supabase';
import type { AppUser } from '@/core/domain/models';
import type { FriendSearchCandidate } from '../domain/repository';

export interface LiveScholarPresence {
  id: string;
  displayName: string;
  emailPrefix: string;
  scholarCode: string;
  avatarUrl: string | null;
  eloRating: number;
  totalScore: number;
}

const onlineScholars = new Map<string, LiveScholarPresence>();
const listeners = new Set<() => void>();
let activeChannel: any = null;
let currentPresenceId: string | null = null;

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignore
    }
  });
}

export function formatScholarCode(userId: string): string {
  return `PAPY-${userId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

export function registerScholarPresence(
  user: AppUser | null,
  eloRating = 1200,
  totalScore = 0
) {
  if (!supabase || !user?.id) {
    if (activeChannel && supabase) {
      void supabase.removeChannel(activeChannel);
      activeChannel = null;
      currentPresenceId = null;
    }
    return;
  }

  const emailPrefix = user.email ? user.email.split('@')[0] || '' : '';
  const payload: LiveScholarPresence = {
    id: user.id,
    displayName: user.displayName || emailPrefix || 'Học giả Papyrus',
    emailPrefix,
    scholarCode: formatScholarCode(user.id),
    avatarUrl: user.avatarUrl ?? null,
    eloRating,
    totalScore,
  };

  if (activeChannel && currentPresenceId === user.id) {
    void activeChannel.track(payload);
    return;
  }

  if (activeChannel) {
    void supabase.removeChannel(activeChannel);
  }

  currentPresenceId = user.id;
  const ch = supabase.channel('papyrus:global-scholars', {
    config: { presence: { key: user.id } },
  });

  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState() as Record<string, LiveScholarPresence[]>;
    onlineScholars.clear();
    Object.values(state).forEach((arr) => {
      const first = arr?.[0];
      if (first?.id) {
        onlineScholars.set(first.id, first);
      }
    });
    notify();
  });

  ch.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') {
      void ch.track(payload);
    }
  });

  activeChannel = ch;
}

export function getOnlineScholarCandidates(excludeUserId?: string): FriendSearchCandidate[] {
  const out: FriendSearchCandidate[] = [];
  onlineScholars.forEach((s) => {
    if (s.id === excludeUserId) return;
    out.push({
      id: s.id,
      displayName: s.displayName,
      avatarUrl: s.avatarUrl,
      eloRating: s.eloRating,
      totalScore: s.totalScore,
    });
  });
  return out;
}

export function searchOnlineScholars(query: string, excludeUserId?: string): FriendSearchCandidate[] {
  const q = query.trim().toLowerCase();
  if (!q) return getOnlineScholarCandidates(excludeUserId);
  const out: FriendSearchCandidate[] = [];
  onlineScholars.forEach((s) => {
    if (s.id === excludeUserId) return;
    const hay = `${s.displayName} ${s.emailPrefix} ${s.scholarCode} ${s.id}`.toLowerCase();
    if (hay.includes(q)) {
      out.push({
        id: s.id,
        displayName: `${s.displayName} (${s.scholarCode})`,
        avatarUrl: s.avatarUrl,
        eloRating: s.eloRating,
        totalScore: s.totalScore,
      });
    }
  });
  return out;
}

export function subscribeOnlineScholars(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
