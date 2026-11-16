import { createAssistantUseCases } from '@/features/assistant/domain/useCases';
import { askPapybot } from '@/features/assistant/data/chat';
import { loadHistory, saveHistory } from '@/features/assistant/data/history';
import { syncHistory, markChatDeleted } from '@/features/assistant/data/historySync';
import { pickPdf } from '@/features/assistant/data/pdf';
import { pickSourceDocument } from '@/features/scan-ocr/data/documentSource';
export const assistant = createAssistantUseCases({ask:askPapybot,load:loadHistory,save:saveHistory,sync:syncHistory,markDeleted:markChatDeleted,pickPdf,pickDocument:pickSourceDocument});
