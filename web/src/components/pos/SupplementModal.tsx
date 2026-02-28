'use client';

import { useState } from 'react';
import { formatPrice, computeTtc } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Minus, Plus } from 'lucide-react';
import type { Product, CartItemSupplement } from '@/types';

interface SupplementModalProps {
  product: Product;
  open: boolean;
  onClose: () => void;
  onConfirm: (product: Product, supplements: CartItemSupplement[]) => void;
}

export function SupplementModal({ product, open, onClose, onConfirm }: SupplementModalProps) {
  const supplements = product.supplements ?? [];
  const [quantities, setQuantities] = useState<Record<number, number>>(
    () => Object.fromEntries(supplements.map((_, i) => [i, 0]))
  );

  const updateQty = (index: number, delta: number) => {
    setQuantities((prev) => {
      const current = prev[index] ?? 0;
      const max = supplements[index].maxQty;
      const next = Math.max(0, Math.min(current + delta, max));
      return { ...prev, [index]: next };
    });
  };

  const supplementsHt = supplements.reduce(
    (sum, sup, i) => sum + sup.priceHt * (quantities[i] ?? 0),
    0
  );

  const totalHt = product.priceHt + supplementsHt;
  const totalTtc = computeTtc(totalHt, Number(product.vatRate));

  const handleConfirm = () => {
    const selected: CartItemSupplement[] = supplements
      .map((sup, i) => ({
        name: sup.name,
        priceHt: sup.priceHt,
        qty: quantities[i] ?? 0,
      }))
      .filter((s) => s.qty > 0);

    onConfirm(product, selected);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">{product.name}</DialogTitle>
          <DialogDescription className="text-center">
            Choisissez vos suppléments
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {supplements.map((sup, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{sup.name}</span>
                {sup.priceHt === 0 ? (
                  <Badge variant="secondary" className="text-xs">Gratuit</Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    +{formatPrice(computeTtc(sup.priceHt, Number(product.vatRate)))}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => updateQty(i, -1)}
                  disabled={(quantities[i] ?? 0) === 0}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center text-sm font-semibold">
                  {quantities[i] ?? 0}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => updateQty(i, 1)}
                  disabled={(quantities[i] ?? 0) >= sup.maxQty}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total TTC</span>
          <span className="text-primary">{formatPrice(totalTtc)}</span>
        </div>

        <Button
          className="w-full bg-green-600 hover:bg-green-700"
          size="lg"
          onClick={handleConfirm}
        >
          Ajouter au panier
        </Button>
      </DialogContent>
    </Dialog>
  );
}
