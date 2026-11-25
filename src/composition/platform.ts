export { aiQuizApi } from '@/features/ai-quiz/services/aiQuiz.api';
export { extractTextFromPdfBase64 } from '@/features/ai-quiz/services/documentTextExtractor';
export { knowledgeSpacesRepository } from '@/features/ai-quiz/data/knowledgeSpacesRepository';
export { quizApi } from '@/features/quiz-library/services/quiz.api';
export { roomApi } from '@/features/multiplayer/services/room.api';
export { gameApi } from '@/features/multiplayer/services/game.api';
export {
  createRealtimeKahootChannel,
  removeRealtimeKahootChannel,
  type RealtimeBroadcastChannel,
} from '@/features/multiplayer/data/kahootRealtimeBridge';
export {
  fetchBillingHistory,
  processBillingCheckout,
} from '@/features/membership/data/billingService';
export { moderationRepository } from '@/features/moderation/data/moderationRepository';
export {
  cancelLiveDuelQueue,
  enqueueLiveDuelQueue,
  pollLiveDuelQueue,
  syncDuelResultToCloud,
} from '@/features/profile/data/profileCloudSync';
export {
  exportBattlePdfReport,
  exportStudyPdfReport,
} from '@/features/study/data/sessionPdf';
export { pickRichSourceDocument } from '@/features/scan-ocr/data/documentSource';
export {
  pickAvatarImageDataUrl,
  pickCoverImageDataUrl,
  pickStoryMedia,
  type PickedStoryMedia,
} from '@/features/scan-ocr/data/mediaPicker';
export { encodeImageUriToJpegBase64 } from '@/features/scan-ocr/data/ocr';
export { checkWebAppVersionUpdate } from '@/features/release/data/webVersionCheck';
export {
  broadcastAdminNotificationToCloud,
  dispatchExternalNotification,
  fetchCloudGiftsForCurrentUser,
  getExternalNotificationPermission,
  listAllUsersForAdmin,
  requestExternalNotificationPermission,
  sendAdminGiftToCloud,
  type AdminUserSummary,
  type ExternalPermissionState,
} from '@/features/notifications/data/pushNotifier';
export { subscribeRealtimeAdminGifts } from '@/features/notifications/data/giftRealtime';
export {
  formatScholarCode,
  getOnlineScholarCandidates,
  registerScholarPresence,
  subscribeOnlineScholars,
} from '@/features/leaderboard/data/liveScholarDirectory';
export { fetchSuggestedScholarsForFriends } from '@/features/leaderboard/data/leaderboardRepository';
export { sendMagicLinkEmail } from '@/features/auth/data/authRepository';
export {
  authenticateWithPasskeyButton,
  beginTotpEnrollment,
  checkSignInRequires2FA,
  confirmTotpEnrollment,
  deleteRegisteredPasskey,
  disableTotp2FA,
  isPlatformPasskeyAvailable,
  loadUserSecuritySnapshot,
  registerNewPasskey,
  renameRegisteredPasskey,
  revokeAllOtherDeviceSessions,
  revokeDeviceSession,
  touchCurrentDeviceSession,
  verifySignIn2FACode,
  type DeviceSessionRecord,
  type PendingTotpEnrollment,
  type StoredPasskeyItem,
  type UserSecuritySnapshot,
} from '@/features/auth/data/securityCenter';
export {
  resolveHistoryConflict,
  type ChatConflictResolution,
} from '@/features/assistant/data/historySync';
export {
  broadcastCommunityEvent,
  fetchDailyUpdatedKnowledgeFeed,
  searchAcademicKnowledgeLive,
  subscribeCommunityRealtime,
  type CommunityRealtimeEvent,
} from '@/features/community/data/communityRealtimeAndSearch';
