'use client';

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ItemCarrito } from '@/types/domain';

interface CartContextValue {
  items: ItemCarrito[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: ItemCarrito) => void;
  changeQty: (key: string, delta: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  count: number;
  subtotal: number;
}

const noopCartContext: CartContextValue = {
  items: [],
  isOpen: false,
  openCart: () => {},
  closeCart: () => {},
  addItem: () => {},
  changeQty: () => {},
  removeItem: () => {},
  clearCart: () => {},
  count: 0,
  subtotal: 0,
};

// Valor por defecto seguro (no null) para que cualquier intento de
// pre-renderizar/SSR un componente que use useCart() sin <CartProvider>
// no truene el build — simplemente se comporta como un carrito vacío
// hasta que el cliente hidrate dentro del Provider real.
const CartContext = createContext<CartContextValue>(noopCartContext);

// Una "key" identifica un item único en el carrito: mismo producto pero
// distinto formato/variedad cuenta como línea separada (igual que el original).
function itemKey(item: Pick<ItemCarrito, 'productoId' | 'formato' | 'variedad'>): string {
  return [item.productoId, item.formato || '', item.variedad || ''].join('::');
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const addItem = useCallback((newItem: ItemCarrito) => {
    setItems((prev) => {
      const key = itemKey(newItem);
      const existing = prev.find((i) => itemKey(i) === key);
      if (existing) {
        return prev.map((i) => (itemKey(i) === key ? { ...i, qty: i.qty + newItem.qty } : i));
      }
      return [...prev, newItem];
    });
  }, []);

  const changeQty = useCallback((key: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) => (itemKey(i) === key ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0)
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => itemKey(i) !== key));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.qty * i.precio, 0), [items]);

  const value: CartContextValue = {
    items,
    isOpen,
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
    addItem,
    changeQty,
    removeItem,
    clearCart,
    count,
    subtotal,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}

export { itemKey };
