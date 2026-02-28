import { create } from 'zustand';
import { getPendingCount } from '@/lib/offline';

interface ConnectivityState {
  isOnline: boolean;
  pendingCount: number;
  setOnline: (online: boolean) => void;
  setPendingCount: (count: number) => void;
  incrementPending: () => void;
  refreshPendingCount: () => Promise<void>;
}

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingCount: 0,
  setOnline: (online) => set({ isOnline: online }),
  setPendingCount: (count) => set({ pendingCount: count }),
  incrementPending: () => set((s) => ({ pendingCount: s.pendingCount + 1 })),
  refreshPendingCount: async () => {
    try {
      const count = await getPendingCount();
      set({ pendingCount: count });
    } catch {
      // IndexedDB unavailable, ignore
    }
  },
}));
