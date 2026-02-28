import { create } from 'zustand';
import type { CartItem, CartItemSupplement, Menu, MenuCartDetail, Product, ServiceMode, VatDetail } from '@/types';
import { computeTtc, computeVatAmount } from '@/lib/utils';

interface CartState {
  items: CartItem[];
  serviceMode: ServiceMode;
  addItem: (product: Product) => void;
  addItemWithSupplements: (product: Product, supplements: CartItemSupplement[]) => void;
  addMenu: (menu: Menu, selectedItems: MenuCartDetail[]) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  addSupplement: (itemId: string, supplement: CartItemSupplement) => void;
  setServiceMode: (mode: ServiceMode) => void;
  clearCart: () => void;
  totalHt: () => number;
  totalTtc: () => number;
  vatDetails: () => VatDetail[];
}

let nextId = 1;

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  serviceMode: 'ONSITE',

  addItem: (product: Product) => {
    set((state) => {
      const vatRate = Number(product.vatRate);

      const existing = state.items.find(
        (item) =>
          item.productId === product.id && item.supplements.length === 0 && !item.isMenu
      );

      if (existing) {
        return {
          items: state.items.map((item) =>
            item.id === existing.id ? { ...item, qty: item.qty + 1 } : item
          ),
        };
      }

      const newItem: CartItem = {
        id: `cart-${nextId++}`,
        productId: product.id,
        name: product.name,
        qty: 1,
        priceHt: product.priceHt,
        vatRate,
        supplements: [],
      };

      return { items: [...state.items, newItem] };
    });
  },

  addItemWithSupplements: (product: Product, supplements: CartItemSupplement[]) => {
    set((state) => {
      const vatRate = Number(product.vatRate);
      const newItem: CartItem = {
        id: `cart-${nextId++}`,
        productId: product.id,
        name: product.name,
        qty: 1,
        priceHt: product.priceHt,
        vatRate,
        supplements,
      };
      return { items: [...state.items, newItem] };
    });
  },

  addMenu: (menu: Menu, selectedItems: MenuCartDetail[]) => {
    set((state) => {
      const newItem: CartItem = {
        id: `cart-${nextId++}`,
        productId: menu.id,
        name: menu.name,
        qty: 1,
        priceHt: menu.priceHt,
        vatRate: Number(menu.vatRate),
        supplements: [],
        isMenu: true,
        menuId: menu.id,
        menuItems: selectedItems,
      };

      return { items: [...state.items, newItem] };
    });
  },

  removeItem: (id: string) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },

  updateQty: (id: string, qty: number) => {
    if (qty <= 0) {
      get().removeItem(id);
      return;
    }
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, qty } : item
      ),
    }));
  },

  addSupplement: (itemId: string, supplement: CartItemSupplement) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId
          ? { ...item, supplements: [...item.supplements, supplement] }
          : item
      ),
    }));
  },

  setServiceMode: (mode: ServiceMode) => {
    set({ serviceMode: mode });
  },

  clearCart: () => {
    set({ items: [] });
  },

  totalHt: () => {
    const { items } = get();
    return items.reduce((sum, item) => {
      const supplementsHt = item.supplements.reduce(
        (s, sup) => s + sup.priceHt * sup.qty,
        0
      );
      return sum + (item.priceHt + supplementsHt) * item.qty;
    }, 0);
  },

  totalTtc: () => {
    const { items } = get();
    let total = 0;
    for (const item of items) {
      const supplementsHt = item.supplements.reduce(
        (s, sup) => s + sup.priceHt * sup.qty,
        0
      );
      if (item.isMenu && item.menuItems && item.menuItems.length > 0) {
        const prorated = prorateMenuHt(item.priceHt + supplementsHt, item.menuItems);
        for (const p of prorated) {
          total += computeTtc(p.baseHt * item.qty, p.rate);
        }
      } else {
        const itemHt = (item.priceHt + supplementsHt) * item.qty;
        total += computeTtc(itemHt, item.vatRate);
      }
    }
    return total;
  },

  vatDetails: () => {
    const { items } = get();
    const vatMap = new Map<number, { baseHt: number; amount: number }>();

    for (const item of items) {
      const supplementsHt = item.supplements.reduce(
        (s, sup) => s + sup.priceHt * sup.qty,
        0
      );

      if (item.isMenu && item.menuItems && item.menuItems.length > 0) {
        const prorated = prorateMenuHt(item.priceHt + supplementsHt, item.menuItems);
        for (const p of prorated) {
          const baseHt = p.baseHt * item.qty;
          const vatAmount = computeVatAmount(baseHt, p.rate);
          const existing = vatMap.get(p.rate);
          if (existing) {
            existing.baseHt += baseHt;
            existing.amount += vatAmount;
          } else {
            vatMap.set(p.rate, { baseHt, amount: vatAmount });
          }
        }
      } else {
        const itemHt = (item.priceHt + supplementsHt) * item.qty;
        const vatAmount = computeVatAmount(itemHt, item.vatRate);
        const existing = vatMap.get(item.vatRate);
        if (existing) {
          existing.baseHt += itemHt;
          existing.amount += vatAmount;
        } else {
          vatMap.set(item.vatRate, { baseHt: itemHt, amount: vatAmount });
        }
      }
    }

    return Array.from(vatMap.entries()).map(([rate, { baseHt, amount }]) => ({
      rate,
      baseHt,
      amount,
    }));
  },
}));

/**
 * Prorate a menu's HT price across its component items based on their
 * original HT price weights, grouped by vatRate.
 */
function prorateMenuHt(
  menuPriceHt: number,
  menuItems: MenuCartDetail[]
): { rate: number; baseHt: number }[] {
  const totalItemsHt = menuItems.reduce((s, mi) => s + mi.priceHt, 0);
  if (totalItemsHt === 0) {
    return [{ rate: 10, baseHt: menuPriceHt }];
  }

  const groups = new Map<number, number>();
  for (const mi of menuItems) {
    groups.set(mi.vatRate, (groups.get(mi.vatRate) ?? 0) + mi.priceHt);
  }

  const result: { rate: number; baseHt: number }[] = [];
  let allocated = 0;
  const entries = Array.from(groups.entries());

  for (let i = 0; i < entries.length; i++) {
    const [rate, weightHt] = entries[i];
    if (i === entries.length - 1) {
      result.push({ rate, baseHt: menuPriceHt - allocated });
    } else {
      const baseHt = Math.round((weightHt / totalItemsHt) * menuPriceHt);
      result.push({ rate, baseHt });
      allocated += baseHt;
    }
  }

  return result;
}
