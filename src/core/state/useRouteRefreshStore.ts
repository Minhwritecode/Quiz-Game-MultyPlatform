import { create } from 'zustand';

export interface InAppDropBannerItem {
  id: string;
  kind: 'message' | 'notification' | 'gift';
  title: string;
  body: string;
  actionRoute: string;
  actionParams?: Record<string, string>;
}

interface RouteRefreshState {
  refreshTick: number;
  isOnline: boolean;
  banner: InAppDropBannerItem | null;
  bumpRouteRefresh: () => void;
  setOnline: (online: boolean) => void;
  showDropBanner: (item: Omit<InAppDropBannerItem, 'id'>) => void;
  dismissDropBanner: () => void;
}

export const useRouteRefreshStore = create<RouteRefreshState>((set) => ({
  refreshTick: 0,
  isOnline: typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true,
  banner: null,
  bumpRouteRefresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),
  setOnline: (online) => set({ isOnline: online }),
  showDropBanner: (item) =>
    set({
      banner: {
        ...item,
        id: `drop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      },
    }),
  dismissDropBanner: () => set({ banner: null }),
}));
