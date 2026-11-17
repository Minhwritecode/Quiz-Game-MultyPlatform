import type { Attempt, SourceDocument, StudyProgress, QuestionSet } from '@/core/domain/models';
import type { QuestionSetRepository } from '@/features/question-sets/domain/repository';
import type { StudyRepository } from '@/features/study/domain/repository';
import type { CloudSets } from './cloudSets';
import type { LearningSync } from './learningSync';
export interface DeviceLearning {
  progress(owner: string): Promise<StudyProgress[]>;
  saveProgress(owner: string, progress: StudyProgress): Promise<void>;
  clearProgress(owner: string, id: string): Promise<void>;
  sources(): Promise<SourceDocument[]>;
  saveSource(document: SourceDocument): Promise<void>;
  removeSource(id: string): Promise<void>;
}
export function createAccountRepositories(owner: () => string | null, sets: CloudSets, learning: LearningSync,
  guestSets: QuestionSetRepository, guestStudy: StudyRepository, device: DeviceLearning, changed: () => void) {
  async function attempts(account: string): Promise<Attempt[]> {
    return (await learning.list(account)).documents.flatMap(d => d.entity === 'attempts' && !d.deleted ? [d.payload] : [])
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  }
  const questionSets: QuestionSetRepository = {
    async list() {
      const account = owner(); if (!account) return guestSets.list();
      const state = await sets.list(account);
      return state.documents.filter(d => !d.deleted).map((d): QuestionSet => {
        const pending = state.pending.find(p => p.document.id === d.id);
        return {...d, syncStatus: pending?.conflict ? 'conflict' : pending?.failures ? 'failed' : pending ? 'pending' : 'synced'};
      });
    },
    async save(set) { const account = owner(); await (account ? sets.save(account, set) : guestSets.save(set)); changed(); },
    async remove(id) { const account = owner(); await (account ? sets.remove(account, id) : guestSets.remove(id)); changed(); },
  };
  const study: StudyRepository = {
    async saveAttempt(attempt) { const account = owner(); await (account ? learning.save(account, 'attempts', attempt) : guestStudy.saveAttempt(attempt)); changed(); },
    async listAttempts() { const account = owner(); return account ? attempts(account) : guestStudy.listAttempts(); },
    async getAttempt(id) { const account = owner(); return account ? (await attempts(account)).find(a => a.id === id) ?? null : guestStudy.getAttempt(id); },
    async getLatestAttempt(id) { const account = owner(); return account ? (await attempts(account)).find(a => a.questionSetId === id) ?? null : guestStudy.getLatestAttempt(id); },
    async getProgress(id) { const account = owner(); return account ? (await device.progress(account)).find(p => p.questionSetId === id) ?? null : guestStudy.getProgress(id); },
    async listProgress() { const account = owner(); return account ? device.progress(account) : guestStudy.listProgress(); },
    async saveProgress(progress) { const account = owner(); return account ? device.saveProgress(account, progress) : guestStudy.saveProgress(progress); },
    async clearProgress(id) { const account = owner(); return account ? device.clearProgress(account, id) : guestStudy.clearProgress(id); },
  };
  const sources = {
    async list(): Promise<SourceDocument[]> { const account = owner(); return account ? (await learning.list(account)).documents.flatMap(d => d.entity === 'source_documents' && !d.deleted ? [d.payload] : []) : device.sources(); },
    async save(document: SourceDocument) { const account = owner(); await (account ? learning.save(account, 'source_documents', document) : device.saveSource(document)); changed(); },
    async remove(id: string) { const account = owner(); await (account ? learning.remove(account, 'source_documents', id) : device.removeSource(id)); changed(); },
  };
  return {questionSets, study, sources};
}
