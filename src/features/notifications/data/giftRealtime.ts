import { supabase } from '@/core/network/supabase';
import type { QuestionSet } from '@/core/domain/models';

export function subscribeRealtimeAdminGifts(
  userId: string,
  onGift: (giftRow: {
    title: string;
    message: string;
    giftType?: 'question_set' | 'study_document' | 'vip_days' | 'streak_freeze';
    questionSet?: QuestionSet;
    documentText?: string;
  }) => void,
  onBroadcastNotif?: (notif: {
    recipientId: string;
    kind: 'system' | 'gift' | 'friend' | 'duel' | 'streak' | 'update';
    title: string;
    body: string;
    actionRoute?: string;
  }) => void
): () => void {
  if (!supabase || !userId) return () => undefined;

  const pgChannel = supabase
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

  const rtChannel = supabase
    .channel('papyrus:admin-broadcasts')
    .on('broadcast', { event: 'admin-gift' }, (msg: { payload?: Record<string, unknown> }) => {
      const p = msg?.payload ?? {};
      const rec = String(p.recipientId ?? '');
      if (rec === 'all' || rec === userId) {
        onGift({
          title: String(p.title || 'Học liệu từ Admin'),
          message: String(p.message || 'Mở Hồ sơ cá nhân để nhận ngay!'),
          giftType: (p.giftType as 'question_set' | 'study_document' | 'vip_days' | 'streak_freeze') ?? 'question_set',
          questionSet: p.questionSet as QuestionSet | undefined,
          documentText: p.documentText as string | undefined,
        });
      }
    })
    .on('broadcast', { event: 'admin-notif' }, (msg: { payload?: Record<string, unknown> }) => {
      if (!onBroadcastNotif) return;
      const p = msg?.payload ?? {};
      const rec = String(p.recipientId ?? 'all');
      if (rec === 'all' || rec === userId) {
        onBroadcastNotif({
          recipientId: rec,
          kind: (p.kind as 'system' | 'update') ?? 'system',
          title: String(p.title || 'Thông báo mới'),
          body: String(p.body || ''),
          actionRoute: typeof p.actionRoute === 'string' ? p.actionRoute : '/',
        });
      }
    })
    .subscribe();

  return () => {
    void supabase?.removeChannel(pgChannel);
    void supabase?.removeChannel(rtChannel);
  };
}
