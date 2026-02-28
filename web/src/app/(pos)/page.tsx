'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { LogOut, UtensilsCrossed, ShoppingBag, Settings } from 'lucide-react';
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

  // Auto-sync when coming back online
  const handleSync = useCallback(async () => {
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
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    const onOnline = () => {
      handleSync();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [handleSync]);

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
      <header className="flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
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
          <span className="text-sm text-muted-foreground">
            {user?.name}
          </span>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
              <Settings className="mr-1 h-4 w-4" />
              Back-office
            </Button>
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
        <div className="w-[380px] border-l bg-white">
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
    </div>
  );
}
