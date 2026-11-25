import type { AssistantRepository } from './repository';
import { AppError } from '@/core/domain/failure';

export function createAssistantUseCases(repository: AssistantRepository) {
  return {
    ...repository,
    ask: ((messages, context, document, signal, onText, pdf, image) => {
      if (
        !messages.length ||
        messages.length > 19 ||
        messages.reduce((n, m) => n + m.content.length, 0) > 16000 ||
        messages.some((m) => !m.content.trim() || m.content.length > 4000)
      ) {
        throw new AppError('validation', 'Hội thoại đã đạt giới hạn. Hãy bắt đầu cuộc trò chuyện mới.');
      }
      if (signal.aborted) throw new AppError('cancelled', 'Đã hủy yêu cầu.');
      return repository.ask(messages, context, document, signal, onText, pdf, image);
    }) as AssistantRepository['ask'],
  };
}
