import { supabase } from '@/core/network/supabase';

export interface RealtimeBroadcastChannel {
  send(message: {
    type: 'broadcast';
    event: string;
    payload: Record<string, unknown>;
  }): Promise<unknown>;
}

export function createRealtimeKahootChannel(
  code: string,
  onBroadcast: (type: string, data: unknown) => void
): RealtimeBroadcastChannel | null {
  if (!supabase || !code) return null;
  const ch = supabase.channel(`kahoot-live:${code}`, {
    config: { broadcast: { self: false } },
  });
  ch.on('broadcast', { event: 'kahoot-msg' }, (msg: { payload?: { type?: string; data?: unknown } }) => {
    const type = msg?.payload?.type;
    if (type) {
      onBroadcast(type, msg?.payload?.data);
    }
  });
  ch.subscribe();
  return ch as unknown as RealtimeBroadcastChannel;
}

export function removeRealtimeKahootChannel(ch: RealtimeBroadcastChannel | null | undefined): void {
  if (!supabase || !ch) return;
  void supabase.removeChannel(ch as never);
}
