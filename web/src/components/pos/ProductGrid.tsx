'use client';

import { useState, useRef, useCallback } from 'react';
import { useCartStore } from '@/stores/cart.store';
import { computeTtc, formatPrice } from '@/lib/utils';
import { MenuSelectionModal } from '@/components/pos/MenuSelectionModal';
import { SupplementModal } from '@/components/pos/SupplementModal';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import type { Product, Category, Menu, CartItemSupplement } from '@/types';

interface ProductGridProps {
  products: Product[];
  categories: Category[];
  menus: Menu[];
}

export function ProductGrid({ products, categories, menus }: ProductGridProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [supplementProduct, setSupplementProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [flashedId, setFlashedId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { addItem, addItemWithSupplements } = useCartStore();

  const sortedCategories = [...categories].sort((a, b) => a.position - b.position);

  const isSearching = searchQuery.trim().length > 0;
  const normalizedQuery = searchQuery.toLowerCase().trim();

  const filteredProducts = isSearching
    ? products.filter((p) => p.name.toLowerCase().includes(normalizedQuery))
    : activeCategory
      ? products.filter((p) => p.categoryId === activeCategory)
      : products;

  const filteredMenus = isSearching
    ? menus.filter((m) => m.name.toLowerCase().includes(normalizedQuery))
    : activeCategory
      ? menus.filter((m) => m.categoryId === activeCategory)
      : menus;

  const triggerFlash = useCallback((id: string) => {
    setFlashedId(id);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
    setTimeout(() => setFlashedId(null), 200);
  }, []);

  const getDisplayPrice = (priceHt: number, vatRate: number): number => {
    return computeTtc(priceHt, Number(vatRate));
  };

  const handleProductClick = (product: Product) => {
    triggerFlash(product.id);
    if (product.supplements && product.supplements.length > 0) {
      setSupplementProduct(product);
    } else {
      addItem(product);
    }
  };

  const handleSupplementConfirm = (product: Product, supplements: CartItemSupplement[]) => {
    if (supplements.length > 0) {
      addItemWithSupplements(product, supplements);
    } else {
      addItem(product);
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Search bar */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un produit..."
          className="h-12 w-full rounded-lg border bg-card pl-10 pr-10 text-base outline-none ring-primary focus:ring-2"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className={`mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide ${isSearching ? 'pointer-events-none opacity-40' : ''}`}>
        <button
          onClick={() => setActiveCategory(null)}
          className={`whitespace-nowrap flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeCategory === null
              ? 'bg-primary text-primary-foreground'
              : 'bg-card border border-border text-foreground hover:bg-accent'
          }`}
        >
          Tout
        </button>
        {sortedCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className="whitespace-nowrap flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-80"
            style={{
              backgroundColor:
                activeCategory === cat.id ? cat.color : `${cat.color}cc`,
              outline: activeCategory === cat.id ? `3px solid ${cat.color}` : 'none',
              outlineOffset: '2px',
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Grid: menus first, then products */}
      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {/* Menus */}
        {filteredMenus.map((menu) => (
          <button
            key={`menu-${menu.id}`}
            onClick={() => { triggerFlash(`menu-${menu.id}`); setSelectedMenu(menu); }}
            className={`relative flex flex-col items-center justify-center rounded-lg border border-primary/30 bg-card p-4 shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-95 ${flashedId === `menu-${menu.id}` ? 'ring-4 ring-green-400 bg-green-50 dark:bg-green-950' : ''}`}
            style={{ minHeight: '100px' }}
          >
            <Badge className="absolute right-2 top-2 bg-primary text-xs">
              Menu
            </Badge>
            <span className="text-center text-base font-semibold text-foreground">
              {menu.name}
            </span>
            <span className="mt-2 text-lg font-bold text-primary">
              {formatPrice(getDisplayPrice(menu.priceHt, menu.vatRate))}
            </span>
            {menu.category && (
              <span
                className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs text-white"
                style={{ backgroundColor: menu.category.color }}
              >
                {menu.category.name}
              </span>
            )}
          </button>
        ))}

        {/* Products */}
        {filteredProducts.map((product) => (
          <button
            key={product.id}
            onClick={() => handleProductClick(product)}
            className={`relative flex flex-col items-center justify-center rounded-lg border border-border bg-card p-4 shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-95 ${flashedId === product.id ? 'ring-4 ring-green-400 bg-green-50 dark:bg-green-950' : ''}`}
            style={{ minHeight: '100px' }}
          >
            {product.supplements && product.supplements.length > 0 && (
              <Badge variant="outline" className="absolute right-2 top-2 text-[10px]">
                Suppl.
              </Badge>
            )}
            <span className="text-center text-base font-semibold text-foreground">
              {product.name}
            </span>
            <span className="mt-2 text-lg font-bold text-primary">
              {formatPrice(getDisplayPrice(product.priceHt, product.vatRate))}
            </span>
            {product.category && (
              <span
                className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs text-white"
                style={{ backgroundColor: product.category.color }}
              >
                {product.category.name}
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredProducts.length === 0 && filteredMenus.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Aucun produit dans cette catégorie</p>
        </div>
      )}

      {/* Menu selection modal */}
      {selectedMenu && (
        <MenuSelectionModal
          menu={selectedMenu}
          open={!!selectedMenu}
          onClose={() => setSelectedMenu(null)}
        />
      )}

      {/* Supplement modal */}
      {supplementProduct && (
        <SupplementModal
          product={supplementProduct}
          open={!!supplementProduct}
          onClose={() => setSupplementProduct(null)}
          onConfirm={handleSupplementConfirm}
        />
      )}
    </div>
  );
}
