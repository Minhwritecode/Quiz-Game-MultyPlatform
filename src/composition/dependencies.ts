import { learning } from './learning';
import { createBattleSessionUseCases } from '@/features/room-battle/domain/session';
import { assistant } from './assistant';
import { battleSession } from '@/features/room-battle/data/session';
import { leaderboardRepository } from '@/features/leaderboard/data/repository';
import { createLeaderboardUseCases } from '@/features/leaderboard/domain/repository';
import {
  fetchFriendsLeaderboard,
  fetchGlobalLeaderboard,
  fetchMyBattleHistory,
} from '@/features/leaderboard/data/leaderboardRepository';
import { pickRichSourceDocument, pickSourceDocument } from '@/features/scan-ocr/data/documentSource';
import { reminders } from '@/features/reminders/data/reminders';
import { roomRepository, battleRepository } from '@/features/room-battle/data/roomRepository';
import { localSyncQueue } from '@/features/sync/data/localQueue';
import { authRepository, updateDisplayName } from '@/features/auth/data/authRepository';
import { cloudSets } from '@/features/sync/data/cloudSets';
import { releaseService } from '@/features/release/data/releaseService';
import { deleteCurrentAccount } from '@/features/auth/data/accountDeletion';
import { captureSourceImage, pickSourceImages } from '@/features/scan-ocr/data/imageSource';
import { recognizeLocalImage } from '@/features/scan-ocr/data/ocr';
import { isGenerationConfigured, requestGeneratedQuestions } from '@/features/quiz-generation/data/edgeFunctionClient';
import { generationJobs } from '@/features/quiz-generation/data/generationJobStorage';
import { generationNetworkAvailable, observeGenerationWake } from '@/features/quiz-generation/data/connectivity';
import { exportStudyPdfReport } from '@/features/study/data/sessionPdf';
import { onboardingRepository } from '@/features/onboarding/data/onboardingRepository';

export const dependencies = {
  assistant,
  battleSession: createBattleSessionUseCases(battleSession),
  leaderboard: {
    ...createLeaderboardUseCases(leaderboardRepository),
    fetchGlobal: fetchGlobalLeaderboard,
    fetchFriends: fetchFriendsLeaderboard,
    fetchBattleHistory: fetchMyBattleHistory,
  },
  reminders,
  release: releaseService,
  deleteCurrentAccount,
  intake: { pickSourceDocument, pickRichSourceDocument, captureSourceImage, pickSourceImages, recognizeLocalImage },
  generation: { configured: isGenerationConfigured, generate: requestGeneratedQuestions, jobs: generationJobs, online: generationNetworkAvailable, observeWake: observeGenerationWake },
  questionSets: learning.questionSets,
  sources: learning.sources,
  learning,
  study: learning.study,
  studyReport: { exportPdf: exportStudyPdfReport },
  rooms: roomRepository,
  battle: battleRepository,
  syncQueue: localSyncQueue,
  auth: authRepository,
  updateDisplayName,
  cloudSets,
  onboarding: onboardingRepository,
};
