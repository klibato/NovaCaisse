'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBadge() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);

    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
      <WifiOff className="h-3 w-3" />
      Hors ligne
    </div>
  );
}
