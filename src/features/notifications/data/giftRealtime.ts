import { supabase } from '@/core/network/supabase';

export function subscribeRealtimeAdminGifts(
  userId: string,
  onGift: (giftRow: { title: string; message: string }) => void
): () => void {
  if (!supabase || !userId) return () => undefined;

  const ch = supabase
    .channel(`user-alerts:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'admin_gifts' },
      (payload: { new?: Record<string, unknown> }) => {
        const rec = String(payload.new?.recipient_id ?? '');
        if (rec === 'all' || rec === userId) {
          onGift({
            title: String(payload.new?.title || 'Học liệu'),
            message: String(payload.new?.message || 'Mở Hồ sơ cá nhân để nhận ngay!'),
          });
        }
      }
    )
    .subscribe();

  return () => {
    void supabase?.removeChannel(ch);
  };
}
