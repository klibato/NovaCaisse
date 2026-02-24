'use client';

import { useCartStore } from '@/stores/cart.store';
import { computeTtc, formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';

interface CartProps {
  onEncaisser: () => void;
}

export function Cart({ onEncaisser }: CartProps) {
  const { items, clearCart, updateQty, removeItem, totalHt, totalTtc, vatDetails } =
    useCartStore();

  const ht = totalHt();
  const ttc = totalTtc();
  const vat = vatDetails();

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <ShoppingCart className="mb-3 h-12 w-12 text-muted-foreground/30" />
        <p className="text-lg font-medium text-muted-foreground">Panier vide</p>
        <p className="mt-1 text-sm text-muted-foreground/60">
          Cliquez sur un produit pour l&apos;ajouter
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-lg font-semibold">
          Panier ({items.reduce((s, i) => s + i.qty, 0)})
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={clearCart}
        >
          Vider
        </Button>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {items.map((item) => {
          const supplementsHt = item.supplements.reduce(
            (s, sup) => s + sup.priceHt * sup.qty,
            0
          );
          const lineHt = (item.priceHt + supplementsHt) * item.qty;
          const lineTtc = computeTtc(lineHt, item.vatRate);

          return (
            <div key={item.id} className="border-b px-4 py-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{item.name}</p>
                  {item.supplements.length > 0 && (
                    <div className="mt-0.5">
                      {item.supplements.map((sup, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          + {sup.name} ({formatPrice(sup.priceHt)})
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-sm font-semibold">{formatPrice(lineTtc)}</p>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQty(item.id, item.qty - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-semibold">
                    {item.qty}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQty(item.id, item.qty + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="border-t bg-gray-50 px-4 py-3">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Total HT</span>
          <span>{formatPrice(ht)}</span>
        </div>
        {vat.map((v) => (
          <div
            key={v.rate}
            className="flex justify-between text-sm text-muted-foreground"
          >
            <span>TVA {v.rate}%</span>
            <span>{formatPrice(v.amount)}</span>
          </div>
        ))}
        <Separator className="my-2" />
        <div className="flex justify-between text-xl font-bold">
          <span>Total TTC</span>
          <span>{formatPrice(ttc)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t p-4">
        <Button
          size="xl"
          className="w-full bg-green-600 text-lg font-bold hover:bg-green-700"
          onClick={onEncaisser}
        >
          Encaisser {formatPrice(ttc)}
        </Button>
      </div>
    </div>
  );
}
