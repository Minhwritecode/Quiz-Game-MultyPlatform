import { questionSetRepository } from '@/features/question-sets/data/persistence';
import { studyRepository } from '@/features/study/data/persistence';
import { roomRepository, battleRepository } from '@/features/room-battle/data/roomRepository';
import { localSyncQueue } from '@/features/sync/data/localQueue';
import { authRepository } from '@/features/auth/data/authRepository';
import { cloudSets } from '@/features/sync/data/cloudSets';
import { releaseService } from '@/features/release/data/releaseService';
import { deleteCurrentAccount } from '@/features/auth/data/accountDeletion';
import { captureSourceImage, pickSourceImages } from '@/features/scan-ocr/data/imageSource';
import { recognizeLocalImage } from '@/features/scan-ocr/data/ocr';
import { isGenerationConfigured, requestGeneratedQuestions } from '@/features/quiz-generation/data/edgeFunctionClient';

export const dependencies = {
  release: releaseService,
  deleteCurrentAccount,
  intake: { captureSourceImage, pickSourceImages, recognizeLocalImage },
  generation: { configured: isGenerationConfigured, generate: requestGeneratedQuestions },
  questionSets: questionSetRepository,
  study: studyRepository,
  rooms: roomRepository,
  battle: battleRepository,
  syncQueue: localSyncQueue,
  auth: authRepository,
  cloudSets,
};
