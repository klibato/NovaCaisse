export interface User {
  id: string;
  name: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER';
  tenantId: string;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  position: number;
  active: boolean;
  _count: {
    products: number;
  };
}

export interface Supplement {
  name: string;
  priceHt: number;
  maxQty: number;
}

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  priceHt: number;
  vatRateOnsite: number;
  vatRateTakeaway: number;
  categoryId: string | null;
  imageUrl: string | null;
  supplements: Supplement[] | null;
  active: boolean;
  createdAt: string;
  category?: {
    id: string;
    name: string;
    color: string;
  };
}

export interface MenuItem {
  id: string;
  menuId: string;
  productId: string;
  product: {
    id: string;
    name: string;
    priceHt: number;
  };
  isChoice: boolean;
  choiceGroup: string | null;
  position: number;
}

export interface Menu {
  id: string;
  tenantId: string;
  name: string;
  priceHt: number;
  vatRateOnsite: number;
  vatRateTakeaway: number;
  categoryId: string | null;
  imageUrl: string | null;
  active: boolean;
  createdAt: string;
  category?: {
    id: string;
    name: string;
    color: string;
  };
  items: MenuItem[];
}

export type ServiceMode = 'ONSITE' | 'TAKEAWAY';
export type PaymentMethod = 'cash' | 'card' | 'meal_voucher' | 'check';

export interface CartItemSupplement {
  name: string;
  priceHt: number;
  qty: number;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  qty: number;
  priceHt: number;
  vatRate: number;
  vatRateOnsite: number;
  vatRateTakeaway: number;
  supplements: CartItemSupplement[];
}

export interface Payment {
  method: PaymentMethod;
  amount: number;
}

export interface VatDetail {
  rate: number;
  baseHt: number;
  amount: number;
}

export interface TicketResponse {
  id: string;
  sequenceNumber: number;
  serviceMode: ServiceMode;
  items: {
    name: string;
    qty: number;
    priceHt: number;
    vatRate: number;
    supplements?: CartItemSupplement[];
  }[];
  totalHt: number;
  totalTtc: number;
  vatDetails: VatDetail[];
  payments: Payment[];
  isExpenseNote: boolean;
  hash: string;
  prevHash: string;
  signature: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}
