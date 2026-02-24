'use client';

import { useState } from 'react';
import { useCartStore } from '@/stores/cart.store';
import { computeTtc, formatPrice } from '@/lib/utils';
import type { Product, Category } from '@/types';

interface ProductGridProps {
  products: Product[];
  categories: Category[];
}

export function ProductGrid({ products, categories }: ProductGridProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { addItem } = useCartStore();

  const sortedCategories = [...categories].sort((a, b) => a.position - b.position);

  const filteredProducts = activeCategory
    ? products.filter((p) => p.categoryId === activeCategory)
    : products;

  const getDisplayPrice = (product: Product): number => {
    return computeTtc(product.priceHt, Number(product.vatRate));
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

      {/* Products grid */}
      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {filteredProducts.map((product) => (
          <button
            key={product.id}
            onClick={() => addItem(product)}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-transparent bg-white p-4 shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-95"
            style={{ minHeight: '100px' }}
          >
            <span className="text-center text-base font-semibold text-foreground">
              {product.name}
            </span>
            <span className="mt-2 text-lg font-bold text-primary">
              {formatPrice(getDisplayPrice(product))}
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

      {filteredProducts.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Aucun produit dans cette catégorie</p>
        </div>
      )}
    </div>
  );
}
