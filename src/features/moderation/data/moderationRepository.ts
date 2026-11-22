import { supabase } from '@/core/network/supabase';
import type {
  AiModerationVerdict,
  ModerationStatus,
  QuestionReportItem,
  SuperadminOverview,
  SuperadminSetRow,
  SuperadminUserRow,
} from '../domain/models';

export const moderationRepository = {
  async insertReport(item: {
    questionRef: string;
    questionPreview: string;
    reason: QuestionReportItem['reason'];
  }): Promise<{ id: string; createdAt: string } | null> {
    if (!supabase) return null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data: inserted } = await supabase
        .from('question_reports')
        .insert({
          reporter_id: userData.user.id,
          question_ref: item.questionRef,
          question_preview: item.questionPreview.slice(0, 240),
          reason: item.reason,
        })
        .select('id, created_at')
        .single();
      if (!inserted?.id) return null;
      return {
        id: String(inserted.id),
        createdAt: String(inserted.created_at ?? new Date().toISOString()),
      };
    } catch {
      return null;
    }
  },

  async updateReportStatus(id: string, status: ModerationStatus): Promise<void> {
    if (!supabase) return;
    try {
      const { error } = await supabase.rpc('review_question_report', {
        p_report_id: id,
        p_status: status,
        p_note: '',
      });
      if (error) {
        await supabase.from('question_reports').update({ status }).eq('id', id);
      }
    } catch {
      // Keep optimistic local update
    }
  },

  async autoModerateReport(id: string): Promise<{
    aiVerdict: AiModerationVerdict;
    aiConfidence: number;
    aiSummary: string;
  } | null> {
    if (!supabase) return null;
    try {
      const { data } = await supabase.rpc('auto_moderate_question_report', {
        p_report_id: id,
      });
      if (!data) return null;
      return {
        aiVerdict: (data.ai_verdict as AiModerationVerdict) ?? 'needs_human',
        aiConfidence: Number(data.ai_confidence ?? 85),
        aiSummary: String(data.ai_summary ?? ''),
      };
    } catch {
      return null;
    }
  },

  async listCloudReports(): Promise<QuestionReportItem[] | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('question_reports')
        .select('id, question_ref, question_preview, reason, status, ai_verdict, ai_confidence, ai_summary, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error || !Array.isArray(data)) return null;
      return data.map((row) => ({
        id: String(row.id),
        questionRef: String(row.question_ref ?? ''),
        questionPreview: String(row.question_preview ?? ''),
        reason: (row.reason as QuestionReportItem['reason']) ?? 'wrong_answer',
        status: (row.status as ModerationStatus) ?? 'open',
        aiVerdict: (row.ai_verdict as AiModerationVerdict) ?? undefined,
        aiConfidence: typeof row.ai_confidence === 'number' ? row.ai_confidence : undefined,
        aiSummary: row.ai_summary ? String(row.ai_summary) : undefined,
        createdAt: String(row.created_at ?? new Date().toISOString()),
        source: 'cloud',
      }));
    } catch {
      return null;
    }
  },

  async fetchSuperadminOverview(): Promise<Partial<SuperadminOverview> | null> {
    if (!supabase) return null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return null;
      const { data, error } = await supabase.rpc('get_superadmin_overview');
      if (error || !data || typeof data !== 'object') return null;
      return data as Partial<SuperadminOverview>;
    } catch {
      return null;
    }
  },

  async updateSuperadminUser(
    userId: string,
    patch: { role?: SuperadminUserRow['role']; membershipTier?: SuperadminUserRow['membershipTier']; isSuspended?: boolean }
  ): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.rpc('superadmin_update_user', {
        p_target_user_id: userId,
        p_role: patch.role ?? null,
        p_membership_tier: patch.membershipTier ?? null,
        p_is_suspended: patch.isSuspended ?? null,
      });
    } catch {
      // Optimistic update stays
    }
  },

  async moderateCommunitySet(
    setId: string,
    patch: { moderationStatus: SuperadminSetRow['moderationStatus']; visibility?: SuperadminSetRow['visibility'] }
  ): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.rpc('superadmin_moderate_question_set', {
        p_set_id: setId,
        p_moderation_status: patch.moderationStatus,
        p_visibility: patch.visibility ?? null,
        p_notes: '',
      });
    } catch {
      // Optimistic update stays
    }
  },
};
