'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ClipboardList, Plus, ChevronLeft, ChevronRight, FileDown } from 'lucide-react';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces',
  card: 'CB',
  meal_voucher: 'Ticket Resto',
  check: 'Chèque',
};

const TYPE_LABELS: Record<string, string> = {
  DAILY: 'Journalière',
  MONTHLY: 'Mensuelle',
  YEARLY: 'Annuelle',
};

interface VatDetail {
  rate: number;
  baseHt: number;
  amount: number;
}

interface PaymentDetail {
  method: string;
  amount: number;
}

interface ClosureTotals {
  totalHt: number;
  totalTtc: number;
  vatDetails: VatDetail[];
  ticketCount: number;
  paymentBreakdown: PaymentDetail[];
}

interface Closure {
  id: string;
  tenantId: string;
  type: 'DAILY' | 'MONTHLY' | 'YEARLY';
  date: string;
  totals: ClosureTotals;
  hash: string;
  createdAt: string;
}

const PAGE_SIZE = 20;

export default function ClosuresPage() {
  const [closures, setClosures] = useState<Closure[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedClosure, setSelectedClosure] = useState<Closure | null>(null);

  const fetchClosures = async (newOffset = 0) => {
    setLoading(true);
    try {
      const res = await api.get<{ closures: Closure[]; total: number }>(
        `/closures?limit=${PAGE_SIZE}&offset=${newOffset}`,
      );
      setClosures(res.closures);
      setTotal(res.total);
      setOffset(newOffset);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosures();
  }, []);

  const handleDailyClosure = async () => {
    setCreating(true);
    try {
      await api.post('/closures/daily', {});
      await fetchClosures(0);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la clôture');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr: string, type: string) => {
    const date = new Date(dateStr);
    if (type === 'MONTHLY') {
      return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }
    if (type === 'YEARLY') {
      return date.getFullYear().toString();
    }
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleExportCsv = () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const token = typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token
      : null;

    fetch(`${API_URL}/closures/export?format=csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clotures-export.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => alert('Erreur lors de l\'export'));
  };

  const handleExport = () => {
    if (!selectedClosure) return;
    const c = selectedClosure;
    const totals = c.totals;

    const lines = [
      `CLÔTURE ${TYPE_LABELS[c.type]}`,
      `Date: ${formatDate(c.date, c.type)}`,
      '',
      `Nombre de tickets: ${totals.ticketCount}`,
      '',
      `Total HT: ${formatPrice(totals.totalHt)}`,
      `Total TTC: ${formatPrice(totals.totalTtc)}`,
      '',
      'TVA:',
      ...totals.vatDetails.map(
        (v) => `  ${v.rate}%: ${formatPrice(v.baseHt)} HT | ${formatPrice(v.amount)} TVA`,
      ),
      '',
      'Paiements:',
      ...totals.paymentBreakdown.map(
        (p) => `  ${PAYMENT_LABELS[p.method] ?? p.method}: ${formatPrice(p.amount)}`,
      ),
      '',
      `Hash: ${c.hash}`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloture-${c.type.toLowerCase()}-${c.date.split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clôtures</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCsv}>
            <FileDown className="mr-2 h-4 w-4" />
            Exporter CSV
          </Button>
          <Button onClick={handleDailyClosure} disabled={creating}>
            <Plus className="mr-2 h-4 w-4" />
            {creating ? 'Clôture en cours...' : 'Clôture du jour'}
          </Button>
        </div>
      </div>

      {loading && closures.length === 0 ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : closures.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5" />
              Aucune clôture
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Cliquez sur &quot;Clôture du jour&quot; pour générer votre première clôture journalière.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {closures.map((closure) => (
              <Card
                key={closure.id}
                className="cursor-pointer transition-colors hover:bg-secondary/50"
                onClick={() => setSelectedClosure(closure)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={closure.type === 'DAILY' ? 'default' : 'secondary'}
                    >
                      {TYPE_LABELS[closure.type]}
                    </Badge>
                    <span className="font-medium">
                      {formatDate(closure.date, closure.type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      {closure.totals.ticketCount} ticket{closure.totals.ticketCount > 1 ? 's' : ''}
                    </span>
                    <span className="font-bold">{formatPrice(closure.totals.totalTtc)}</span>
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
                onClick={() => fetchClosures(Math.max(0, offset - PAGE_SIZE))}
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
                onClick={() => fetchClosures(offset + PAGE_SIZE)}
              >
                Suivant
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Détail clôture */}
      {selectedClosure && (
        <Dialog open onOpenChange={() => setSelectedClosure(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Clôture {TYPE_LABELS[selectedClosure.type]}
              </DialogTitle>
              <DialogDescription>
                {formatDate(selectedClosure.date, selectedClosure.type)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total HT</p>
                    <p className="text-lg font-bold">{formatPrice(selectedClosure.totals.totalHt)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total TTC</p>
                    <p className="text-lg font-bold text-primary">
                      {formatPrice(selectedClosure.totals.totalTtc)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                {selectedClosure.totals.ticketCount} ticket{selectedClosure.totals.ticketCount > 1 ? 's' : ''}
              </div>

              <Separator />

              {/* TVA */}
              <div>
                <p className="mb-2 text-sm font-medium">TVA par taux</p>
                {selectedClosure.totals.vatDetails.map((vat) => (
                  <div key={vat.rate} className="flex justify-between text-sm">
                    <span>TVA {vat.rate}% (base: {formatPrice(vat.baseHt)})</span>
                    <span className="font-medium">{formatPrice(vat.amount)}</span>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Paiements */}
              <div>
                <p className="mb-2 text-sm font-medium">Ventilation paiements</p>
                {selectedClosure.totals.paymentBreakdown.map((pay) => (
                  <div key={pay.method} className="flex justify-between text-sm">
                    <span>{PAYMENT_LABELS[pay.method] ?? pay.method}</span>
                    <span className="font-medium">{formatPrice(pay.amount)}</span>
                  </div>
                ))}
              </div>

              <Separator />

              <p className="text-center text-xs text-muted-foreground">
                Hash: {selectedClosure.hash.substring(0, 16)}...
              </p>
            </div>

            <Button variant="outline" className="w-full" onClick={handleExport}>
              <FileDown className="mr-2 h-4 w-4" />
              Exporter
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
