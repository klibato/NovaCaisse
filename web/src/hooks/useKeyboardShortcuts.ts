'use client';

import { useEffect, useCallback } from 'react';
import { useCartStore } from '@/stores/cart.store';

interface ShortcutCallbacks {
  onOpenPayment: () => void;
  onCloseModal: () => void;
  onToggleHelp: () => void;
}

export function useKeyboardShortcuts({
  onOpenPayment,
  onCloseModal,
  onToggleHelp,
}: ShortcutCallbacks) {
  const { items, clearCart, serviceMode, setServiceMode } = useCartStore();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        if (e.key === 'Escape') {
          onCloseModal();
        }
        return;
      }

      switch (e.key) {
        case 'Enter':
          if (items.length > 0) {
            e.preventDefault();
            onOpenPayment();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onCloseModal();
          break;
        case 'Delete':
          if (items.length > 0) {
            e.preventDefault();
            if (window.confirm('Vider le panier ?')) {
              clearCart();
            }
          }
          break;
        case 'F2':
          e.preventDefault();
          setServiceMode(serviceMode === 'ONSITE' ? 'TAKEAWAY' : 'ONSITE');
          break;
        case '?':
          e.preventDefault();
          onToggleHelp();
          break;
      }
    },
    [items, clearCart, serviceMode, setServiceMode, onOpenPayment, onCloseModal, onToggleHelp],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export const SHORTCUTS = [
  { key: 'Entrée', description: 'Ouvrir le paiement (si panier non vide)' },
  { key: 'Échap', description: 'Fermer le modal ouvert' },
  { key: 'Suppr', description: 'Vider le panier (avec confirmation)' },
  { key: 'F2', description: 'Toggle sur place / emporter' },
  { key: '?', description: 'Afficher les raccourcis clavier' },
];
