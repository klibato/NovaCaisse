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
import type { Product, CartItemSupplement, CartItemOption, OptionGroup } from '@/types';

interface ProductOptionsModalProps {
  product: Product;
  open: boolean;
  onClose: () => void;
  onConfirm: (product: Product, supplements: CartItemSupplement[], options: CartItemOption[]) => void;
}

export function ProductOptionsModal({ product, open, onClose, onConfirm }: ProductOptionsModalProps) {
  const supplements = product.supplements ?? [];
  const optionGroups = product.optionGroups ?? [];

  // Supplement quantities
  const [quantities, setQuantities] = useState<Record<number, number>>(
    () => Object.fromEntries(supplements.map((_, i) => [i, 0]))
  );

  // Option selections: groupId -> choiceId(s)
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const group of optionGroups) {
      init[group.id] = [];
    }
    return init;
  });

  const updateQty = (index: number, delta: number) => {
    setQuantities((prev) => {
      const current = prev[index] ?? 0;
      const max = supplements[index].maxQty;
      const next = Math.max(0, Math.min(current + delta, max));
      return { ...prev, [index]: next };
    });
  };

  const toggleChoice = (group: OptionGroup, choiceId: string) => {
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      if (group.multiple) {
        // Multiple selection
        if (current.includes(choiceId)) {
          return { ...prev, [group.id]: current.filter((id) => id !== choiceId) };
        }
        if (current.length >= group.maxChoices) {
          return prev;
        }
        return { ...prev, [group.id]: [...current, choiceId] };
      } else {
        // Single selection (radio)
        if (current.includes(choiceId)) {
          return { ...prev, [group.id]: [] };
        }
        return { ...prev, [group.id]: [choiceId] };
      }
    });
  };

  // Check all required groups have a selection
  const allRequiredFilled = optionGroups
    .filter((g) => g.required)
    .every((g) => (selections[g.id] ?? []).length > 0);

  // Calculate total price
  const supplementsHt = supplements.reduce(
    (sum, sup, i) => sum + sup.priceHt * (quantities[i] ?? 0),
    0
  );

  const optionsHt = optionGroups.reduce((sum, group) => {
    const selected = selections[group.id] ?? [];
    return sum + group.choices
      .filter((c) => selected.includes(c.id))
      .reduce((s, c) => s + c.priceHt, 0);
  }, 0);

  const totalHt = product.priceHt + supplementsHt + optionsHt;
  const totalTtc = computeTtc(totalHt, Number(product.vatRate));

  const handleConfirm = () => {
    const selectedSupplements: CartItemSupplement[] = supplements
      .map((sup, i) => ({
        name: sup.name,
        priceHt: sup.priceHt,
        qty: quantities[i] ?? 0,
      }))
      .filter((s) => s.qty > 0);

    const selectedOptions: CartItemOption[] = [];
    for (const group of optionGroups) {
      const selected = selections[group.id] ?? [];
      for (const choiceId of selected) {
        const choice = group.choices.find((c) => c.id === choiceId);
        if (choice) {
          selectedOptions.push({
            groupName: group.name,
            choiceName: choice.name,
            priceHt: choice.priceHt,
          });
        }
      }
    }

    onConfirm(product, selectedSupplements, selectedOptions);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">{product.name}</DialogTitle>
          <DialogDescription className="text-center">
            Personnalisez votre produit
          </DialogDescription>
        </DialogHeader>

        {/* Option Groups */}
        {optionGroups.map((group) => (
          <div key={group.id}>
            <div className="mb-2 flex items-center gap-2">
              <span className="font-semibold">{group.name}</span>
              {group.required ? (
                <Badge variant="destructive" className="text-[10px]">Obligatoire</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Optionnel</Badge>
              )}
              {group.multiple && (
                <span className="text-xs text-muted-foreground">
                  (max {group.maxChoices})
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {group.choices.map((choice) => {
                const isSelected = (selections[group.id] ?? []).includes(choice.id);
                return (
                  <button
                    key={choice.id}
                    onClick={() => toggleChoice(group, choice.id)}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <span className="font-medium">{choice.name}</span>
                    {choice.priceHt > 0 ? (
                      <span className="text-sm text-muted-foreground">
                        +{formatPrice(computeTtc(choice.priceHt, Number(product.vatRate)))}
                      </span>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Inclus</Badge>
                    )}
                  </button>
                );
              })}
            </div>
            <Separator className="my-3" />
          </div>
        ))}

        {/* Supplements */}
        {supplements.length > 0 && (
          <>
            <div className="mb-2 font-semibold">Suppléments</div>
            <div className="space-y-2">
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
          </>
        )}

        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total TTC</span>
          <span className="text-primary">{formatPrice(totalTtc)}</span>
        </div>

        <Button
          className="w-full bg-green-600 hover:bg-green-700"
          size="lg"
          onClick={handleConfirm}
          disabled={!allRequiredFilled}
        >
          {allRequiredFilled ? 'Ajouter au panier' : 'Complétez les options obligatoires'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
