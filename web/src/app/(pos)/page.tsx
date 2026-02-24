'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import { api } from '@/lib/api';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { Cart } from '@/components/pos/Cart';
import { PaymentModal } from '@/components/pos/PaymentModal';
import { TicketConfirmation } from '@/components/pos/TicketConfirmation';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { LogOut, UtensilsCrossed, ShoppingBag } from 'lucide-react';
import type { Product, Category, TicketResponse } from '@/types';

export default function PosPage() {
  const { user, logout } = useAuthStore();
  const { serviceMode, setServiceMode } = useCartStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [confirmedTicket, setConfirmedTicket] = useState<TicketResponse | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prods, cats] = await Promise.all([
          api.get<Product[]>('/products'),
          api.get<Category[]>('/categories'),
        ]);
        setProducts(prods);
        setCategories(cats);
      } catch (err) {
        console.error('Erreur chargement données:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-foreground">NovaCaisse</h1>
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
            serviceMode={serviceMode}
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
