export type ModerationStatus = 'open' | 'reviewed' | 'dismissed';
export type AiModerationVerdict = 'pending' | 'valid_report' | 'false_alarm' | 'needs_human';

export interface QuestionReportItem {
  id: string;
  questionRef: string;
  questionPreview: string;
  reason: 'wrong_answer' | 'typo_format' | 'inappropriate' | 'duplicate';
  status: ModerationStatus;
  aiVerdict?: AiModerationVerdict;
  aiConfidence?: number;
  aiSummary?: string;
  createdAt: string;
  source: 'local' | 'cloud';
}

export interface SuperadminUserRow {
  id: string;
  displayName: string;
  role: 'user' | 'moderator' | 'superadmin';
  membershipTier: 'apprentice' | 'archmage';
  eloRating: number;
  gamesPlayed: number;
  isSuspended: boolean;
}

export interface SuperadminSetRow {
  id: string;
  title: string;
  subject: string;
  visibility: 'private' | 'shared';
  moderationStatus: 'pending_review' | 'approved' | 'flagged' | 'rejected';
  moderationScore: number;
}

export interface SuperadminOverview {
  metrics: {
    totalUsers: number;
    vipUsers: number;
    totalSets: number;
    sharedSets: number;
    openReports: number;
    totalMatches: number;
    totalKnowledgeChunks: number;
  };
  users: SuperadminUserRow[];
  questionSets: SuperadminSetRow[];
}

export interface DraftModerationGateResult {
  passed: boolean;
  score: number;
  status: 'approved' | 'flagged';
  issues: string[];
}
