'use client';

import { useState, useMemo } from 'react';
import { useCartStore } from '@/stores/cart.store';
import { computeTtc, formatPrice } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Menu, MenuCartDetail } from '@/types';

interface MenuSelectionModalProps {
  menu: Menu;
  open: boolean;
  onClose: () => void;
}

export function MenuSelectionModal({ menu, open, onClose }: MenuSelectionModalProps) {
  const { addMenu } = useCartStore();

  // Group items: fixed (non-choice) + choice groups
  const { fixedItems, choiceGroups } = useMemo(() => {
    const fixed: Menu['items'] = [];
    const groups = new Map<string, Menu['items']>();

    for (const item of menu.items) {
      if (item.isChoice && item.choiceGroup) {
        const group = groups.get(item.choiceGroup) ?? [];
        group.push(item);
        groups.set(item.choiceGroup, group);
      } else {
        fixed.push(item);
      }
    }

    return { fixedItems: fixed, choiceGroups: groups };
  }, [menu.items]);

  // Track selection for each choice group: groupName -> productId
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const [group, items] of choiceGroups.entries()) {
      if (items.length > 0) {
        init[group] = items[0].productId;
      }
    }
    return init;
  });

  const allGroupsSelected = Array.from(choiceGroups.keys()).every(
    (group) => selections[group]
  );

  const handleAdd = () => {
    // Build the selected items list for the cart
    const selectedItems: MenuCartDetail[] = [];

    // Fixed items always included
    for (const item of fixedItems) {
      selectedItems.push({
        name: item.product.name,
        priceHt: item.product.priceHt,
        vatRate: Number(item.product.vatRate),
      });
    }

    // Add selected choice from each group
    for (const [group, productId] of Object.entries(selections)) {
      const groupItems = choiceGroups.get(group);
      const selected = groupItems?.find((i) => i.productId === productId);
      if (selected) {
        selectedItems.push({
          name: selected.product.name,
          priceHt: selected.product.priceHt,
          vatRate: Number(selected.product.vatRate),
        });
      }
    }

    addMenu(menu, selectedItems);
    onClose();
  };

  const menuTtc = computeTtc(menu.priceHt, Number(menu.vatRate));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{menu.name}</DialogTitle>
          <DialogDescription>
            <span className="text-2xl font-bold text-foreground">
              {formatPrice(menuTtc)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Fixed items */}
          {fixedItems.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-muted-foreground uppercase">
                Inclus
              </p>
              {fixedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{item.product.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Choice groups */}
          {Array.from(choiceGroups.entries()).map(([group, items]) => (
            <div key={group}>
              <Separator className="mb-3" />
              <p className="mb-2 text-sm font-semibold text-muted-foreground uppercase">
                Choisissez votre {group}
              </p>
              <div className="space-y-1">
                {items.map((item) => {
                  const isSelected = selections[group] === item.productId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setSelections((prev) => ({ ...prev, [group]: item.productId }))
                      }
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? 'bg-primary/10 ring-2 ring-primary'
                          : 'bg-secondary/30 hover:bg-secondary/60'
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          isSelected
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground/40'
                        }`}
                      >
                        {isSelected && (
                          <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <span className="font-medium text-foreground">
                        {item.product.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <Button
          size="xl"
          className="mt-2 w-full bg-green-600 text-lg font-bold hover:bg-green-700"
          onClick={handleAdd}
          disabled={!allGroupsSelected}
        >
          Ajouter au panier
        </Button>
      </DialogContent>
    </Dialog>
  );
}
