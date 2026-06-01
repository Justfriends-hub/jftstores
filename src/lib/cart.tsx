import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  productId: string;
  sellerId: string;
  sellerSlug: string;
  sellerName: string;
  sellerWhatsApp?: string | null;
  productName: string;
  price: number;
  image?: string | null;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  clearSeller: (sellerId: string) => void;
  count: number;
  total: number;
  bySeller: Array<{
    sellerId: string;
    sellerSlug: string;
    sellerName: string;
    sellerWhatsApp?: string | null;
    items: CartItem[];
    subtotal: number;
  }>;
};

const CartContext = createContext<CartState | undefined>(undefined);
const KEY = "jfts.cart.v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* noop */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* noop */
    }
  }, [items, hydrated]);

  const bySeller = useMemo(() => {
    const map = new Map<string, CartState["bySeller"][number]>();
    for (const it of items) {
      const entry = map.get(it.sellerId) ?? {
        sellerId: it.sellerId,
        sellerSlug: it.sellerSlug,
        sellerName: it.sellerName,
        sellerWhatsApp: it.sellerWhatsApp,
        items: [],
        subtotal: 0,
      };
      entry.items.push(it);
      entry.subtotal += it.price * it.quantity;
      map.set(it.sellerId, entry);
    }
    return Array.from(map.values());
  }, [items]);

  const value: CartState = {
    items,
    add: (item, qty = 1) =>
      setItems((prev) => {
        const i = prev.findIndex((p) => p.productId === item.productId);
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i], quantity: next[i].quantity + qty };
          return next;
        }
        return [...prev, { ...item, quantity: qty }];
      }),
    remove: (productId) => setItems((prev) => prev.filter((p) => p.productId !== productId)),
    setQty: (productId, qty) =>
      setItems((prev) =>
        qty <= 0
          ? prev.filter((p) => p.productId !== productId)
          : prev.map((p) => (p.productId === productId ? { ...p, quantity: qty } : p)),
      ),
    clear: () => setItems([]),
    clearSeller: (sellerId) => setItems((prev) => prev.filter((p) => p.sellerId !== sellerId)),
    count: items.reduce((n, i) => n + i.quantity, 0),
    total: items.reduce((n, i) => n + i.price * i.quantity, 0),
    bySeller,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}
