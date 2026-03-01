'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Printer, ChefHat, CloudOff } from 'lucide-react';
import type { TicketResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces',
  card: 'CB',
  meal_voucher: 'Ticket Resto',
  check: 'Chèque',
};

interface TicketConfirmationProps {
  ticket: TicketResponse;
  onNewTicket: () => void;
}

export function TicketConfirmation({ ticket, onNewTicket }: TicketConfirmationProps) {
  const isOfflineTicket = ticket.id.startsWith('offline-');
  const cashPayment = ticket.payments.find((p) => p.method === 'cash');
  const totalPaid = ticket.payments.reduce((s, p) => s + p.amount, 0);
  const changeDue = cashPayment && totalPaid > ticket.totalTtc ? totalPaid - ticket.totalTtc : 0;
  const [printing, setPrinting] = useState(false);
  const [printingKitchen, setPrintingKitchen] = useState(false);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/tickets/${ticket.id}/print`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Erreur impression');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      // silently fail
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintKitchen = async () => {
    setPrintingKitchen(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/tickets/${ticket.id}/print-kitchen`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Erreur impression');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      // silently fail
    } finally {
      setPrintingKitchen(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onNewTicket()}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="text-center">
          <div className={`mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full ${isOfflineTicket ? 'bg-orange-100' : 'bg-green-100'}`}>
            {isOfflineTicket ? (
              <CloudOff className="h-10 w-10 text-orange-500" />
            ) : (
              <CheckCircle className="h-10 w-10 text-green-600" />
            )}
          </div>
          <DialogTitle className="text-center text-xl">
            {isOfflineTicket ? 'Ticket enregistré' : 'Ticket validé'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isOfflineTicket ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 border border-orange-300">
                <CloudOff className="h-3.5 w-3.5" />
                En attente de sync
              </span>
            ) : (
              <>Ticket #{ticket.sequenceNumber}</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Badge variant={ticket.serviceMode === 'ONSITE' ? 'default' : 'secondary'}>
              {ticket.serviceMode === 'ONSITE' ? 'Sur place' : 'À emporter'}
            </Badge>
            {ticket.isExpenseNote && (
              <Badge variant="outline">Note de frais</Badge>
            )}
          </div>

          <Separator />

          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total TTC</p>
            <p className="text-3xl font-bold">{formatPrice(ticket.totalTtc)}</p>
          </div>

          <Separator />

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Paiement</p>
            {ticket.payments.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{PAYMENT_LABELS[p.method] || p.method}</span>
                <span className="font-medium">{formatPrice(p.amount)}</span>
              </div>
            ))}
          </div>

          {changeDue > 0 && (
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <p className="text-sm text-muted-foreground">Rendu monnaie</p>
              <p className="text-xl font-bold text-green-600">
                {formatPrice(changeDue)}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handlePrint}
            disabled={printing || isOfflineTicket}
            title={isOfflineTicket ? 'Disponible après synchronisation' : undefined}
          >
            <Printer className="mr-2 h-4 w-4" />
            {printing ? 'Impression...' : 'Imprimer'}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrintKitchen}
            disabled={printingKitchen || isOfflineTicket}
            title={isOfflineTicket ? 'Disponible après synchronisation' : 'Ticket cuisine'}
          >
            <ChefHat className="h-4 w-4" />
          </Button>
          <Button
            className="flex-1 bg-primary"
            onClick={onNewTicket}
          >
            Nouveau ticket
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('auth-storage');
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    return parsed.state?.token || null;
  } catch {
    return null;
  }
}
