import type { QuestionSet } from '@/core/domain/models';

export function chooseLatest(local: QuestionSet, remote: QuestionSet): QuestionSet {
  return new Date(remote.updatedAt).getTime() > new Date(local.updatedAt).getTime() ? remote : local;
}
