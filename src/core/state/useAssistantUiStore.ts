import { create } from 'zustand';

interface AssistantUiState {
  open: boolean;
  initialPrompt: string | null;
  openAssistant: (prompt?: string) => void;
  closeAssistant: () => void;
  consumeInitialPrompt: () => void;
}

export const useAssistantUiStore = create<AssistantUiState>((set) => ({
  open: false,
  initialPrompt: null,
  openAssistant: (prompt) =>
    set({
      open: true,
      initialPrompt: prompt?.trim() ? prompt.trim() : null,
    }),
  closeAssistant: () => set({ open: false }),
  consumeInitialPrompt: () => set({ initialPrompt: null }),
}));
