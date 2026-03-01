'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import { useConnectivityStore } from '@/stores/connectivity.store';
import { api } from '@/lib/api';
import { cacheData, getCachedData, syncPendingTickets } from '@/lib/offline';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { Cart } from '@/components/pos/Cart';
import { PaymentModal } from '@/components/pos/PaymentModal';
import { TicketConfirmation } from '@/components/pos/TicketConfirmation';
import { InstallPrompt } from '@/components/shared/InstallPrompt';
import { OfflineBadge } from '@/components/shared/OfflineBadge';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { LogOut, UtensilsCrossed, ShoppingBag, Settings, ClipboardList, Printer, Keyboard } from 'lucide-react';
import { usePrinterStore } from '@/stores/printer.store';
import { formatPrice } from '@/lib/utils';
import { useKeyboardShortcuts, SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import type { Product, Category, Menu, TicketResponse } from '@/types';

export default function PosPage() {
  const { user, logout } = useAuthStore();
  const { serviceMode, setServiceMode } = useCartStore();
  const { refreshPendingCount } = useConnectivityStore();
  const router = useRouter();
  const isAdmin = user?.role === 'OWNER' || user?.role === 'MANAGER';
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [confirmedTicket, setConfirmedTicket] = useState<TicketResponse | null>(null);
  const [syncNotification, setSyncNotification] = useState<string | null>(null);
  const [showClosure, setShowClosure] = useState(false);
  const [closureLoading, setClosureLoading] = useState(false);
  const [closureResult, setClosureResult] = useState<{ totalTtc: number; ticketCount: number } | null>(null);
  const [closureError, setClosureError] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);

  useKeyboardShortcuts({
    onOpenPayment: () => { if (!showPayment && !confirmedTicket) setShowPayment(true); },
    onCloseModal: () => {
      if (showShortcuts) { setShowShortcuts(false); return; }
      if (showPayment) { setShowPayment(false); return; }
      if (showClosure) { setShowClosure(false); return; }
    },
    onToggleHelp: () => setShowShortcuts((v) => !v),
  });

  const handleClosure = async () => {
    setClosureLoading(true);
    setClosureError('');
    setClosureResult(null);
    try {
      const result = await api.post<{ totals: { totalTtc: number; ticketCount: number } }>('/closures/daily', {});
      setClosureResult(result.totals);
    } catch (err) {
      setClosureError(err instanceof Error ? err.message : 'Erreur lors de la clôture');
    } finally {
      setClosureLoading(false);
    }
  };

  // Load data with offline cache fallback
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prods, cats, mns] = await Promise.all([
          api.get<Product[]>('/products'),
          api.get<Category[]>('/categories'),
          api.get<Menu[]>('/menus'),
        ]);
        setProducts(prods);
        setCategories(cats);
        setMenus(mns);
        // Cache for offline use
        await Promise.all([
          cacheData('products', prods),
          cacheData('categories', cats),
          cacheData('menus', mns),
        ]);
      } catch {
        // Network down: load from cache
        console.warn('[NovaCaisse] Chargement depuis le cache offline');
        const [cachedProds, cachedCats, cachedMenus] = await Promise.all([
          getCachedData<Product[]>('products'),
          getCachedData<Category[]>('categories'),
          getCachedData<Menu[]>('menus'),
        ]);
        if (cachedProds) setProducts(cachedProds);
        if (cachedCats) setCategories(cachedCats);
        if (cachedMenus) setMenus(cachedMenus);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Auto-sync when coming back online (with lock to prevent concurrent syncs)
  const syncingRef = React.useRef(false);
  const handleSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const synced = await syncPendingTickets(async (payload) => {
        return api.post('/tickets', payload);
      });
      if (synced > 0) {
        await refreshPendingCount();
        const msg = `${synced} ticket${synced > 1 ? 's' : ''} synchronisé${synced > 1 ? 's' : ''}`;
        setSyncNotification(msg);
        setTimeout(() => setSyncNotification(null), 5000);
      }
    } catch {
      console.warn('[NovaCaisse] Erreur lors de la synchronisation');
    } finally {
      syncingRef.current = false;
    }
  }, [refreshPendingCount]);

  // Trigger sync on browser 'online' event (WiFi reconnect)
  useEffect(() => {
    const onOnline = () => {
      handleSync();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [handleSync]);

  // Poll API when marked offline to detect container restart
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const pendingCount = useConnectivityStore((s) => s.pendingCount);

  useEffect(() => {
    // Only poll when we're marked offline OR have pending tickets
    if (isOnline && pendingCount === 0) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    const pollApi = async () => {
      try {
        const res = await fetch(`${API_URL}/products`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok || res.status === 401) {
          // API is reachable (even 401 means server is up)
          useConnectivityStore.getState().setOnline(true);
          handleSync();
        }
      } catch {
        // Still unreachable, keep polling
      }
    };

    const interval = setInterval(pollApi, 5000);
    // Also try immediately
    pollApi();

    return () => clearInterval(interval);
  }, [isOnline, pendingCount, handleSync]);

  const handlePaymentSuccess = (ticket: TicketResponse) => {
    setShowPayment(false);
    setConfirmedTicket(ticket);
  };

  const handleNewTicket = () => {
    setConfirmedTicket(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-lg text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Install prompt */}
      <InstallPrompt />

      {/* Sync notification */}
      {syncNotification && (
        <div className="flex items-center justify-center bg-green-600 px-4 py-2 text-sm font-medium text-white">
          {syncNotification}
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between border-b bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-foreground">NovaCaisse</h1>
          <OfflineBadge />
          <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5">
            <UtensilsCrossed
              className={`h-4 w-4 ${serviceMode === 'ONSITE' ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <span className={`text-sm font-medium ${serviceMode === 'ONSITE' ? 'text-primary' : 'text-muted-foreground'}`}>
              Sur place
            </span>
            <Switch
              checked={serviceMode === 'TAKEAWAY'}
              onCheckedChange={(checked) =>
                setServiceMode(checked ? 'TAKEAWAY' : 'ONSITE')
              }
            />
            <ShoppingBag
              className={`h-4 w-4 ${serviceMode === 'TAKEAWAY' ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <span className={`text-sm font-medium ${serviceMode === 'TAKEAWAY' ? 'text-primary' : 'text-muted-foreground'}`}>
              Emporter
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {usePrinterStore.getState().isSupported && (
            <PrinterButton />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShortcuts(true)}
            title="Raccourcis clavier"
          >
            <Keyboard className="h-4 w-4" />
            ?
          </Button>
          <ThemeToggle />
          <span className="text-sm text-muted-foreground">
            {user?.name}
          </span>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => { setShowClosure(true); setClosureResult(null); setClosureError(''); }}>
                <ClipboardList className="mr-1 h-4 w-4" />
                Clôture Z
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
                <Settings className="mr-1 h-4 w-4" />
                Back-office
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="mr-1 h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Product grid - left */}
        <div className="flex-1 overflow-y-auto p-4">
          <ProductGrid
            products={products}
            categories={categories}
            menus={menus}
          />
        </div>

        {/* Cart - right */}
        <div className="w-[380px] border-l bg-card">
          <Cart onEncaisser={() => setShowPayment(true)} />
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          open={showPayment}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Ticket Confirmation */}
      {confirmedTicket && (
        <TicketConfirmation
          ticket={confirmedTicket}
          onNewTicket={handleNewTicket}
        />
      )}

      {/* Shortcuts Help Modal */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Raccourcis clavier</DialogTitle>
            <DialogDescription>
              Raccourcis disponibles sur l&apos;écran de caisse
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {SHORTCUTS.map((s) => (
              <div key={s.key} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{s.description}</span>
                <kbd className="rounded border bg-secondary px-2 py-1 text-xs font-mono font-semibold">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Clôture Z Modal */}
      <Dialog open={showClosure} onOpenChange={setShowClosure}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clôture Z</DialogTitle>
            <DialogDescription>
              Générer la clôture journalière du jour.
            </DialogDescription>
          </DialogHeader>

          {closureError && (
            <p className="rounded-md bg-destructive/10 p-2 text-center text-sm text-destructive">
              {closureError}
            </p>
          )}

          {closureResult ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-950">
                <p className="text-sm text-muted-foreground">CA TTC du jour</p>
                <p className="text-3xl font-bold text-green-600">{formatPrice(closureResult.totalTtc)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Nombre de tickets</p>
                <p className="text-xl font-bold">{closureResult.ticketCount}</p>
              </div>
              <Button className="w-full" onClick={() => setShowClosure(false)}>
                Fermer
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowClosure(false)}>
                Annuler
              </Button>
              <Button
                className="flex-1"
                onClick={handleClosure}
                disabled={closureLoading}
              >
                {closureLoading ? 'Génération...' : 'Générer la clôture du jour'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PrinterButton() {
  const { isConnected, connect, disconnect } = usePrinterStore();

  return (
    <Button
      variant={isConnected ? 'default' : 'outline'}
      size="sm"
      onClick={isConnected ? disconnect : connect}
      title={isConnected ? 'Imprimante connectée — cliquer pour déconnecter' : 'Connecter une imprimante'}
    >
      <Printer className="mr-1 h-4 w-4" />
      {isConnected ? 'Imprimante' : 'Imprimante'}
    </Button>
  );
}
