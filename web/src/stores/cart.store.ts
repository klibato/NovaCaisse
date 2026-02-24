import { create } from 'zustand';
import type { CartItem, CartItemSupplement, Product, ServiceMode, VatDetail } from '@/types';
import { computeTtc, computeVatAmount } from '@/lib/utils';

interface CartState {
  items: CartItem[];
  serviceMode: ServiceMode;
  addItem: (product: Product) => void;
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
          item.productId === product.id && item.supplements.length === 0
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
    return items.reduce((sum, item) => {
      const supplementsHt = item.supplements.reduce(
        (s, sup) => s + sup.priceHt * sup.qty,
        0
      );
      const itemHt = (item.priceHt + supplementsHt) * item.qty;
      return sum + computeTtc(itemHt, item.vatRate);
    }, 0);
  },

  vatDetails: () => {
    const { items } = get();
    const vatMap = new Map<number, { baseHt: number; amount: number }>();

    for (const item of items) {
      const supplementsHt = item.supplements.reduce(
        (s, sup) => s + sup.priceHt * sup.qty,
        0
      );
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

    return Array.from(vatMap.entries()).map(([rate, { baseHt, amount }]) => ({
      rate,
      baseHt,
      amount,
    }));
  },
}));
