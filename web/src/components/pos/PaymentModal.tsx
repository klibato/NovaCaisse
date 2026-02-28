'use client';

import { useState } from 'react';
import { useCartStore } from '@/stores/cart.store';
import { api } from '@/lib/api';
import { queueTicket } from '@/lib/offline';
import { formatPrice, centsToEuros, eurosToCents } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Banknote,
  CreditCard,
  UtensilsCrossed,
  FileText,
  Receipt,
} from 'lucide-react';
import type { PaymentMethod, TicketResponse, Payment } from '@/types';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (ticket: TicketResponse) => void;
}

const PAYMENT_METHODS: { method: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { method: 'cash', label: 'Espèces', icon: <Banknote className="h-6 w-6" /> },
  { method: 'card', label: 'CB', icon: <CreditCard className="h-6 w-6" /> },
  { method: 'meal_voucher', label: 'Ticket Resto', icon: <UtensilsCrossed className="h-6 w-6" /> },
  { method: 'check', label: 'Chèque', icon: <FileText className="h-6 w-6" /> },
];

export function PaymentModal({ open, onClose, onSuccess }: PaymentModalProps) {
  const { items, serviceMode, totalTtc, totalHt, vatDetails, clearCart } = useCartStore();
  const ttc = totalTtc();

  const [isMixte, setIsMixte] = useState(false);
  const [isExpenseNote, setIsExpenseNote] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [mixedPayments, setMixedPayments] = useState<Record<PaymentMethod, string>>({
    cash: '',
    card: '',
    meal_voucher: '',
    check: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const cashReceivedCents = eurosToCents(parseFloat(cashReceived) || 0);
  const changeDue = cashReceivedCents > ttc ? cashReceivedCents - ttc : 0;

  const mixedTotal = Object.values(mixedPayments).reduce(
    (sum, val) => sum + eurosToCents(parseFloat(val) || 0),
    0
  );
  const mixedRemaining = ttc - mixedTotal;

  const handleSimplePayment = async (method: PaymentMethod) => {
    if (method === 'cash') {
      setSelectedMethod('cash');
      return;
    }
    await submitTicket([{ method, amount: ttc }]);
  };

  const handleCashConfirm = async () => {
    if (cashReceivedCents < ttc) {
      setError('Montant insuffisant');
      return;
    }
    await submitTicket([{ method: 'cash', amount: ttc }]);
  };

  const handleMixedConfirm = async () => {
    if (Math.abs(mixedRemaining) > 1) {
      setError('La somme des paiements doit correspondre au total');
      return;
    }

    const payments: Payment[] = [];
    for (const [method, value] of Object.entries(mixedPayments)) {
      const amount = eurosToCents(parseFloat(value) || 0);
      if (amount > 0) {
        payments.push({ method: method as PaymentMethod, amount });
      }
    }

    if (payments.length === 0) {
      setError('Entrez au moins un montant');
      return;
    }

    await submitTicket(payments);
  };

  const submitTicket = async (payments: Payment[]) => {
    setIsSubmitting(true);
    setError('');

    try {
      const ticketItems: { name: string; qty: number; priceHt: number; vatRate: number; supplements?: typeof items[0]['supplements'] }[] = [];

      for (const item of items) {
        if (item.isMenu && item.menuItems && item.menuItems.length > 0) {
          // Expand menu into prorated items for TVA ventilation
          const totalComponentHt = item.menuItems.reduce((s, mi) => s + mi.priceHt, 0);

          if (totalComponentHt > 0) {
            let allocated = 0;
            for (let i = 0; i < item.menuItems.length; i++) {
              const mi = item.menuItems[i];
              let proratedHt: number;
              if (i === item.menuItems.length - 1) {
                proratedHt = item.priceHt - allocated;
              } else {
                proratedHt = Math.round((mi.priceHt / totalComponentHt) * item.priceHt);
                allocated += proratedHt;
              }
              ticketItems.push({
                name: `${item.name} — ${mi.name}`,
                qty: item.qty,
                priceHt: proratedHt,
                vatRate: mi.vatRate,
              });
            }
          } else {
            ticketItems.push({
              name: item.name,
              qty: item.qty,
              priceHt: item.priceHt,
              vatRate: item.vatRate,
            });
          }
        } else {
          ticketItems.push({
            name: item.name,
            qty: item.qty,
            priceHt: item.priceHt,
            vatRate: item.vatRate,
            supplements: item.supplements.length > 0 ? item.supplements : undefined,
          });
        }
      }

      const payload = {
        serviceMode,
        items: ticketItems,
        payments,
        isExpenseNote,
      };

      try {
        const ticket = await api.post<TicketResponse>('/tickets', payload);
        clearCart();
        onSuccess(ticket);
      } catch (networkErr) {
        // If offline, queue the ticket for later sync
        if (!navigator.onLine) {
          await queueTicket(payload);
          clearCart();
          onSuccess({
            id: `offline-${Date.now()}`,
            sequenceNumber: 0,
            serviceMode,
            items: ticketItems,
            totalHt: 0,
            totalTtc: payments.reduce((s, p) => s + p.amount, 0),
            vatDetails: [],
            payments,
            hash: 'offline',
            prevHash: '',
            signature: '',
            createdAt: new Date().toISOString(),
            isExpenseNote,
          } as TicketResponse);
        } else {
          throw networkErr;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la validation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Paiement</DialogTitle>
          <DialogDescription className="text-center">
            <span className="text-3xl font-bold text-foreground">
              {formatPrice(ttc)}
            </span>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="rounded-md bg-destructive/10 p-2 text-center text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Options */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch checked={isMixte} onCheckedChange={setIsMixte} />
            <Label>Paiement mixte</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isExpenseNote} onCheckedChange={setIsExpenseNote} />
            <Label className="flex items-center gap-1">
              <Receipt className="h-4 w-4" />
              Note de frais
            </Label>
          </div>
        </div>

        <Separator />

        {!isMixte ? (
          <>
            {/* Simple payment */}
            {!selectedMethod && (
              <div className="grid grid-cols-2 gap-3">
                {PAYMENT_METHODS.map(({ method, label, icon }) => (
                  <Button
                    key={method}
                    variant="outline"
                    className="flex h-20 flex-col gap-2"
                    onClick={() => handleSimplePayment(method)}
                    disabled={isSubmitting}
                  >
                    {icon}
                    <span className="text-sm font-semibold">{label}</span>
                  </Button>
                ))}
              </div>
            )}

            {/* Cash input */}
            {selectedMethod === 'cash' && (
              <div className="space-y-4">
                <div>
                  <Label>Montant reçu (euros)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cashReceived}
                    onChange={(e) => {
                      setCashReceived(e.target.value);
                      setError('');
                    }}
                    placeholder={centsToEuros(ttc)}
                    className="mt-1 h-14 text-center text-2xl"
                    autoFocus
                  />
                </div>

                {/* Quick amounts */}
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 20, 50].map((amount) => (
                    <Button
                      key={amount}
                      variant="secondary"
                      onClick={() => setCashReceived(amount.toFixed(2))}
                    >
                      {amount} €
                    </Button>
                  ))}
                </div>

                {changeDue > 0 && (
                  <div className="rounded-lg bg-green-50 p-3 text-center">
                    <p className="text-sm text-muted-foreground">Rendu monnaie</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatPrice(changeDue)}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSelectedMethod(null);
                      setCashReceived('');
                    }}
                  >
                    Retour
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={handleCashConfirm}
                    disabled={isSubmitting || !cashReceived}
                  >
                    {isSubmitting ? 'Validation...' : 'Valider'}
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Mixed payment */}
            <div className="space-y-3">
              {PAYMENT_METHODS.map(({ method, label, icon }) => (
                <div key={method} className="flex items-center gap-3">
                  <div className="flex w-32 items-center gap-2">
                    {icon}
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={mixedPayments[method]}
                    onChange={(e) =>
                      setMixedPayments((prev) => ({
                        ...prev,
                        [method]: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                    className="h-12 text-right text-lg"
                  />
                  <span className="text-sm text-muted-foreground">€</span>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-secondary p-3">
              <div className="flex justify-between text-sm">
                <span>Total saisi</span>
                <span className="font-semibold">{formatPrice(mixedTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Reste à payer</span>
                <span
                  className={`font-semibold ${
                    mixedRemaining > 1 ? 'text-destructive' : 'text-green-600'
                  }`}
                >
                  {mixedRemaining > 0 ? formatPrice(mixedRemaining) : '0.00 €'}
                </span>
              </div>
            </div>

            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
              onClick={handleMixedConfirm}
              disabled={isSubmitting || Math.abs(mixedRemaining) > 1}
            >
              {isSubmitting ? 'Validation...' : 'Valider le paiement'}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
