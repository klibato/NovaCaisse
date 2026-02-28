'use client';

import { useState } from 'react';
import { useCartStore } from '@/stores/cart.store';
import { computeTtc, formatPrice } from '@/lib/utils';
import { MenuSelectionModal } from '@/components/pos/MenuSelectionModal';
import { SupplementModal } from '@/components/pos/SupplementModal';
import { Badge } from '@/components/ui/badge';
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
  const { addItem, addItemWithSupplements } = useCartStore();

  const sortedCategories = [...categories].sort((a, b) => a.position - b.position);

  const filteredProducts = activeCategory
    ? products.filter((p) => p.categoryId === activeCategory)
    : products;

  const filteredMenus = activeCategory
    ? menus.filter((m) => m.categoryId === activeCategory)
    : menus;

  const getDisplayPrice = (priceHt: number, vatRate: number): number => {
    return computeTtc(priceHt, Number(vatRate));
  };

  const handleProductClick = (product: Product) => {
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
    <div className="flex h-full flex-col">
      {/* Category tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCategory(null)}
          className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeCategory === null
              ? 'bg-foreground text-background'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          Tout
        </button>
        {sortedCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-80"
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
            onClick={() => setSelectedMenu(menu)}
            className="relative flex flex-col items-center justify-center rounded-xl border-2 border-primary/30 bg-primary/5 p-4 shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-95"
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
            className="relative flex flex-col items-center justify-center rounded-xl border-2 border-transparent bg-white p-4 shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-95"
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
