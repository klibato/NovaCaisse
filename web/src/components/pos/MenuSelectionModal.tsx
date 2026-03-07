'use client';

import { useState, useMemo } from 'react';
import { useCartStore } from '@/stores/cart.store';
import { formatPrice } from '@/lib/utils';
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
import type { Menu, MenuCartDetail, CartItemOption, OptionGroup } from '@/types';

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

  // Track option selections per product: productId -> { optionGroupId -> choiceId[] }
  const [productOptions, setProductOptions] = useState<Record<string, Record<string, string[]>>>({});

  const toggleOptionChoice = (productId: string, group: OptionGroup, choiceId: string) => {
    setProductOptions((prev) => {
      const productOpts = prev[productId] ?? {};
      const current = productOpts[group.id] ?? [];

      let next: string[];
      if (group.multiple) {
        if (current.includes(choiceId)) {
          next = current.filter((id) => id !== choiceId);
        } else if (current.length >= group.maxChoices) {
          return prev;
        } else {
          next = [...current, choiceId];
        }
      } else {
        next = current.includes(choiceId) ? [] : [choiceId];
      }

      return {
        ...prev,
        [productId]: { ...productOpts, [group.id]: next },
      };
    });
  };

  // Collect all products that need options (fixed + selected choices)
  const allSelectedProducts = useMemo(() => {
    const prods: { productId: string; product: Menu['items'][0]['product'] }[] = [];

    for (const item of fixedItems) {
      if (item.product.optionGroups && item.product.optionGroups.length > 0) {
        prods.push({ productId: item.productId, product: item.product });
      }
    }

    for (const [group, productId] of Object.entries(selections)) {
      const groupItems = choiceGroups.get(group);
      const selected = groupItems?.find((i) => i.productId === productId);
      if (selected?.product.optionGroups && selected.product.optionGroups.length > 0) {
        prods.push({ productId: selected.productId, product: selected.product });
      }
    }

    return prods;
  }, [fixedItems, selections, choiceGroups]);

  // Check all required option groups are filled
  const allRequiredOptionsFilled = useMemo(() => {
    for (const { productId, product } of allSelectedProducts) {
      const optionGroups = product.optionGroups ?? [];
      for (const group of optionGroups) {
        if (group.required) {
          const selected = productOptions[productId]?.[group.id] ?? [];
          if (selected.length === 0) return false;
        }
      }
    }
    return true;
  }, [allSelectedProducts, productOptions]);

  const allGroupsSelected = Array.from(choiceGroups.keys()).every(
    (group) => selections[group]
  );

  const canAdd = allGroupsSelected && allRequiredOptionsFilled;

  // Build CartItemOption[] for a given product
  const buildOptionsForProduct = (productId: string, optionGroups: OptionGroup[]): CartItemOption[] => {
    const result: CartItemOption[] = [];
    const opts = productOptions[productId] ?? {};
    for (const group of optionGroups) {
      const selectedIds = opts[group.id] ?? [];
      for (const choiceId of selectedIds) {
        const choice = group.choices.find((c) => c.id === choiceId);
        if (choice) {
          result.push({
            groupName: group.name,
            choiceName: choice.name,
            priceHt: choice.priceHt,
            priceTtc: choice.priceTtc,
          });
        }
      }
    }
    return result;
  };

  const handleAdd = () => {
    const selectedItems: MenuCartDetail[] = [];

    // Fixed items
    for (const item of fixedItems) {
      const options = (item.product.optionGroups && item.product.optionGroups.length > 0)
        ? buildOptionsForProduct(item.productId, item.product.optionGroups)
        : undefined;
      selectedItems.push({
        name: item.product.name,
        priceHt: item.product.priceHt,
        priceTtc: item.product.priceTtc,
        vatRate: Number(item.product.vatRate),
        options: options && options.length > 0 ? options : undefined,
      });
    }

    // Selected choices
    for (const [group, productId] of Object.entries(selections)) {
      const groupItems = choiceGroups.get(group);
      const selected = groupItems?.find((i) => i.productId === productId);
      if (selected) {
        const options = (selected.product.optionGroups && selected.product.optionGroups.length > 0)
          ? buildOptionsForProduct(selected.productId, selected.product.optionGroups)
          : undefined;
        selectedItems.push({
          name: selected.product.name,
          priceHt: selected.product.priceHt,
          priceTtc: selected.product.priceTtc,
          vatRate: Number(selected.product.vatRate),
          options: options && options.length > 0 ? options : undefined,
        });
      }
    }

    addMenu(menu, selectedItems);
    onClose();
  };

  const menuTtc = menu.priceTtc;

  // Render option groups for a product inline
  const renderProductOptions = (productId: string, optionGroups: OptionGroup[], _vatRate: number) => (
    <div className="ml-4 mt-1 space-y-2">
      {optionGroups.map((group) => (
        <div key={group.id}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-semibold">{group.name}</span>
            {group.required ? (
              <Badge variant="destructive" className="text-[9px] px-1 py-0">Obligatoire</Badge>
            ) : (
              <Badge variant="secondary" className="text-[9px] px-1 py-0">Optionnel</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {group.choices.map((choice) => {
              const isSelected = (productOptions[productId]?.[group.id] ?? []).includes(choice.id);
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => toggleOptionChoice(productId, group, choice.id)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {choice.name}
                  {choice.priceTtc > 0 && (
                    <span className="ml-1 text-muted-foreground">
                      +{formatPrice(choice.priceTtc)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
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
                <div key={item.id}>
                  <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                    <span className="font-medium">{item.product.name}</span>
                  </div>
                  {item.product.optionGroups && item.product.optionGroups.length > 0 &&
                    renderProductOptions(item.productId, item.product.optionGroups, Number(item.product.vatRate))}
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
                  const hasOpts = item.product.optionGroups && item.product.optionGroups.length > 0;
                  return (
                    <div key={item.id}>
                      <button
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
                      {isSelected && hasOpts &&
                        renderProductOptions(item.productId, item.product.optionGroups!, Number(item.product.vatRate))}
                    </div>
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
          disabled={!canAdd}
        >
          {canAdd ? 'Ajouter au panier' : 'Complétez les options obligatoires'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
