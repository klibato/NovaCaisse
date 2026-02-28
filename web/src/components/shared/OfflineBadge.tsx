'use client';

import { useEffect } from 'react';
import { WifiOff, Clock } from 'lucide-react';
import { useConnectivityStore } from '@/stores/connectivity.store';

export function OfflineBadge() {
  const { isOnline, pendingCount, setOnline, refreshPendingCount } =
    useConnectivityStore();

  useEffect(() => {
    // Initialize from navigator
    setOnline(navigator.onLine);

    const goOffline = () => setOnline(false);
    const goOnline = () => {
      setOnline(true);
      refreshPendingCount();
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    // Load initial pending count
    refreshPendingCount();

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [setOnline, refreshPendingCount]);

  return (
    <>
      {!isOnline && (
        <div className="flex animate-pulse items-center gap-1.5 rounded-md bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
          <WifiOff className="h-3.5 w-3.5" />
          Hors ligne
        </div>
      )}
      {pendingCount > 0 && (
        <div className="flex items-center gap-1.5 rounded-md bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 border border-orange-300">
          <Clock className="h-3.5 w-3.5" />
          {pendingCount} en attente
        </div>
      )}
    </>
  );
}
