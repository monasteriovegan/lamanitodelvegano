'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
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
  replaceCart: (items: ItemCarrito[]) => void;
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
  replaceCart: () => {},
  count: 0,
  subtotal: 0,
};

const CartContext = createContext<CartContextValue>(noopCartContext);
const CART_STORAGE_KEY = 'lmv_cart_v1';

function itemKey(item: Pick<ItemCarrito, 'productoId' | 'formato' | 'variedad'>): string {
  return [item.productoId, item.formato || '', item.variedad || ''].join('::');
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || '[]');
      if (Array.isArray(stored)) setItems(stored as ItemCarrito[]);
    } catch {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  const addItem = useCallback((newItem: ItemCarrito) => {
    setItems((prev) => {
      const key = itemKey(newItem);
      const existing = prev.find((i) => itemKey(i) === key);
      const next = existing
        ? prev.map((i) => (itemKey(i) === key ? { ...i, qty: i.qty + newItem.qty } : i))
        : [...prev, newItem];
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const changeQty = useCallback((key: string, delta: number) => {
    setItems((prev) => {
      const next = prev
        .map((i) => (itemKey(i) === key ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0);
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => itemKey(i) !== key);
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, '[]');
    setItems([]);
  }, []);

  const replaceCart = useCallback((nextItems: ItemCarrito[]) => {
    const safe = Array.isArray(nextItems) ? nextItems.filter((item) => item?.productoId && Number(item.qty) > 0) : [];
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(safe));
    setItems(safe);
  }, []);

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
    replaceCart,
    count,
    subtotal,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}

export { itemKey };
