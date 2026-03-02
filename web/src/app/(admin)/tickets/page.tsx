'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Ban,
  X,
} from 'lucide-react';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Especes',
  card: 'CB',
  meal_voucher: 'Ticket Resto',
  check: 'Cheque',
};

const MODE_LABELS: Record<string, string> = {
  ONSITE: 'Sur place',
  TAKEAWAY: 'Emporter',
};

type DateFilter = 'today' | 'week' | 'month' | 'custom';

interface TicketItem {
  name: string;
  qty: number;
  priceHt: number;
  vatRate: number;
  supplements?: { name: string; priceHt: number; qty: number }[];
}

interface VatDetail {
  rate: number;
  baseHt: number;
  amount: number;
}

interface Payment {
  method: string;
  amount: number;
}

interface Ticket {
  id: string;
  sequenceNumber: number;
  serviceMode: string;
  items: TicketItem[];
  totalHt: number;
  totalTtc: number;
  vatDetails: VatDetail[];
  payments: Payment[];
  isExpenseNote: boolean;
  isCancellation: boolean;
  cancelledRef: string | null;
  cancelled: boolean;
  cancelledTicketId: string | null;
  cancellationReason: string | null;
  hash: string;
  userId: string | null;
  createdAt: string;
}

const PAGE_SIZE = 20;

export default function TicketsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [cancelTicket, setCancelTicket] = useState<Ticket | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const getDateRange = useCallback((): { from?: string; to?: string } => {
    const now = new Date();
    switch (dateFilter) {
      case 'today': {
        const d = now.toISOString().split('T')[0];
        return { from: d, to: d };
      }
      case 'week': {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay() + 1);
        return { from: start.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
      }
      case 'month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: start.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
      }
      case 'custom':
        return { from: customFrom || undefined, to: customTo || undefined };
    }
  }, [dateFilter, customFrom, customTo]);

  const fetchTickets = useCallback(
    async (newOffset = 0) => {
      setLoading(true);
      try {
        const range = getDateRange();
        const params = new URLSearchParams();
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(newOffset));
        if (searchQuery) params.set('search', searchQuery);
        if (range.from) params.set('from', range.from);
        if (range.to) params.set('to', range.to);

        const res = await api.get<{ tickets: Ticket[]; total: number }>(
          `/tickets?${params.toString()}`,
        );
        setTickets(res.tickets);
        setTotal(res.total);
        setOffset(newOffset);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [getDateRange, searchQuery],
  );

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleSearch = () => {
    fetchTickets(0);
  };

  const handleCancel = async () => {
    if (!cancelTicket || !cancelReason.trim()) return;
    setCancelLoading(true);
    try {
      await api.post(`/tickets/${cancelTicket.id}/cancel`, { reason: cancelReason.trim() });
      setCancelTicket(null);
      setCancelReason('');
      await fetchTickets(offset);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de l\'annulation');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleExportCsv = () => {
    const range = getDateRange();
    const params = new URLSearchParams();
    params.set('format', 'csv');
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const token = typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token
      : null;

    fetch(`${API_URL}/tickets/export?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tickets-${range.from ?? 'all'}-${range.to ?? 'all'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => alert('Erreur lors de l\'export'));
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tickets</h1>
        <Button variant="outline" onClick={handleExportCsv}>
          <FileDown className="mr-2 h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="N° ticket..."
            className="h-9 w-40 rounded-md border bg-card pl-9 pr-3 text-sm outline-none ring-primary focus:ring-2"
          />
        </div>

        {/* Date filter */}
        <div className="flex gap-1">
          {[
            { value: 'today' as const, label: "Aujourd'hui" },
            { value: 'week' as const, label: 'Semaine' },
            { value: 'month' as const, label: 'Mois' },
            { value: 'custom' as const, label: 'Personnalisé' },
          ].map((f) => (
            <Button
              key={f.value}
              variant={dateFilter === f.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 rounded-md border bg-card px-2 text-sm"
            />
            <span className="text-sm text-muted-foreground">au</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 rounded-md border bg-card px-2 text-sm"
            />
          </div>
        )}
      </div>

      {/* Ticket list */}
      {loading && tickets.length === 0 ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Aucun ticket pour cette période</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <Card
                key={ticket.id}
                className={`cursor-pointer transition-colors hover:bg-secondary/50 ${ticket.cancelled ? 'opacity-60' : ''}`}
                onClick={() => setSelectedTicket(ticket)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-sm font-bold ${ticket.cancelled ? 'text-destructive line-through' : ''}`}>
                      #{ticket.sequenceNumber}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatDateTime(ticket.createdAt)}
                    </span>
                    <Badge variant={ticket.serviceMode === 'ONSITE' ? 'default' : 'secondary'}>
                      {MODE_LABELS[ticket.serviceMode]}
                    </Badge>
                    {ticket.isCancellation && (
                      <Badge variant="destructive">Annulation</Badge>
                    )}
                    {ticket.cancelled && (
                      <Badge variant="outline" className="border-destructive text-destructive">
                        Annulé
                      </Badge>
                    )}
                    {ticket.isExpenseNote && (
                      <Badge variant="outline">Note de frais</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {ticket.cancelled && ticket.cancellationReason && (
                      <span className="max-w-[200px] truncate text-xs text-destructive">
                        {ticket.cancellationReason}
                      </span>
                    )}
                    <span className={`font-bold ${ticket.cancelled ? 'text-destructive line-through' : ''}`}>
                      {formatPrice(ticket.totalTtc)}
                    </span>
                    {isAdmin && !ticket.cancelled && !ticket.isCancellation && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCancelTicket(ticket);
                        }}
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => fetchTickets(Math.max(0, offset - PAGE_SIZE))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Précédent
              </Button>
              <span className="text-sm text-muted-foreground">
                {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} sur {total}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => fetchTickets(offset + PAGE_SIZE)}
              >
                Suivant
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <Dialog open onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className={selectedTicket.cancelled ? 'line-through text-destructive' : ''}>
                Ticket #{selectedTicket.sequenceNumber}
              </DialogTitle>
              <DialogDescription>
                {formatDateTime(selectedTicket.createdAt)} — {MODE_LABELS[selectedTicket.serviceMode]}
              </DialogDescription>
            </DialogHeader>

            {selectedTicket.cancelled && selectedTicket.cancellationReason && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <strong>Annulé :</strong> {selectedTicket.cancellationReason}
              </div>
            )}

            {/* Items */}
            <div>
              <p className="mb-2 text-sm font-medium">Articles</p>
              {selectedTicket.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>
                    {item.qty}x {item.name}
                    {item.supplements && item.supplements.length > 0 && (
                      <span className="text-muted-foreground">
                        {' '}(+{item.supplements.map((s) => s.name).join(', ')})
                      </span>
                    )}
                  </span>
                  <span className="font-medium">{formatPrice(item.priceHt * item.qty)}</span>
                </div>
              ))}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Total HT</span>
                <span>{formatPrice(selectedTicket.totalHt)}</span>
              </div>
              {selectedTicket.vatDetails.map((vat) => (
                <div key={vat.rate} className="flex justify-between text-sm text-muted-foreground">
                  <span>TVA {vat.rate}%</span>
                  <span>{formatPrice(vat.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold">
                <span>Total TTC</span>
                <span>{formatPrice(selectedTicket.totalTtc)}</span>
              </div>
            </div>

            <Separator />

            {/* Payments */}
            <div>
              <p className="mb-2 text-sm font-medium">Paiements</p>
              {selectedTicket.payments.map((p, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{PAYMENT_LABELS[p.method] ?? p.method}</span>
                  <span>{formatPrice(p.amount)}</span>
                </div>
              ))}
            </div>

            <Separator />

            <p className="text-center text-xs text-muted-foreground">
              Hash: {selectedTicket.hash.substring(0, 16)}...
            </p>
          </DialogContent>
        </Dialog>
      )}

      {/* Cancel Ticket Modal */}
      {cancelTicket && (
        <Dialog open onOpenChange={() => { setCancelTicket(null); setCancelReason(''); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Annuler le ticket #{cancelTicket.sequenceNumber}</DialogTitle>
              <DialogDescription>
                Total: {formatPrice(cancelTicket.totalTtc)}. Cette action est irréversible.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Motif d&apos;annulation</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Erreur de saisie, client parti..."
                  className="h-20 w-full rounded-md border bg-card p-2 text-sm outline-none ring-primary focus:ring-2"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setCancelTicket(null); setCancelReason(''); }}
                >
                  Retour
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleCancel}
                  disabled={cancelLoading || !cancelReason.trim()}
                >
                  {cancelLoading ? 'Annulation...' : 'Confirmer l\'annulation'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
