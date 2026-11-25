import { createAssistantUseCases } from '@/features/assistant/domain/useCases';
import { askPapybot } from '@/features/assistant/data/chat';
import { loadHistory, saveHistory } from '@/features/assistant/data/history';
import { syncHistory, markChatDeleted } from '@/features/assistant/data/historySync';
import { pickPdf } from '@/features/assistant/data/pdf';
import { pickSourceDocument } from '@/features/scan-ocr/data/documentSource';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';

export const assistant = createAssistantUseCases({
  ask: (messages, context, document, signal, onText, pdf, image) =>
    askPapybot(
      messages,
      context,
      document,
      signal,
      onText,
      pdf,
      usePapyrusStore.getState().questionSets,
      image,
      true
    ),
  load: loadHistory,
  save: saveHistory,
  sync: syncHistory,
  markDeleted: markChatDeleted,
  pickPdf,
  pickDocument: pickSourceDocument,
});
