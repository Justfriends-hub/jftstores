import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  productId: string;
  sellerId: string;
  sellerSlug: string;
  sellerName: string;
  sellerWhatsApp?: string | null;
  productName: string;
  price: number;
  negotiatedPrice?: number | null;
  negotiationId?: string | null;
  image?: string | null;
  quantity: number;
};

export function effectivePrice(i: CartItem): number {
  return typeof i.negotiatedPrice === "number" && i.negotiatedPrice > 0 && i.negotiatedPrice < i.price
    ? i.negotiatedPrice
    : i.price;
}

export function isMultiStoreCart(items: CartItem[]): boolean {
  return new Set(items.map((i) => i.sellerId)).size > 1;
}

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  clearSeller: (sellerId: string) => void;
  applyNegotiation: (productId: string, negotiatedPrice: number, negotiationId: string) => void;
  clearNegotiation: (productId: string) => void;
  syncNegotiations: (map: Map<string, { price: number; id: string }>) => void;
  count: number;
  total: number; // effective (negotiated where applicable)
  originalTotal: number;
  savings: number;
  multiStore: boolean;
  bySeller: Array<{
    sellerId: string;
    sellerSlug: string;
    sellerName: string;
    sellerWhatsApp?: string | null;
    items: CartItem[];
    subtotal: number;
    originalSubtotal: number;
    savings: number;
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
    } catch { /* noop */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* noop */ }
  }, [items, hydrated]);

  const bySeller = useMemo(() => {
    const map = new Map<string, CartState["bySeller"][number]>();
    for (const it of items) {
      const eff = effectivePrice(it);
      const entry = map.get(it.sellerId) ?? {
        sellerId: it.sellerId,
        sellerSlug: it.sellerSlug,
        sellerName: it.sellerName,
        sellerWhatsApp: it.sellerWhatsApp,
        items: [],
        subtotal: 0,
        originalSubtotal: 0,
        savings: 0,
      };
      entry.items.push(it);
      entry.subtotal += eff * it.quantity;
      entry.originalSubtotal += it.price * it.quantity;
      entry.savings += (it.price - eff) * it.quantity;
      map.set(it.sellerId, entry);
    }
    return Array.from(map.values());
  }, [items]);

  const total = items.reduce((n, i) => n + effectivePrice(i) * i.quantity, 0);
  const originalTotal = items.reduce((n, i) => n + i.price * i.quantity, 0);

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
    applyNegotiation: (productId, negotiatedPrice, negotiationId) =>
      setItems((prev) =>
        prev.map((p) => (p.productId === productId ? { ...p, negotiatedPrice, negotiationId } : p)),
      ),
    clearNegotiation: (productId) =>
      setItems((prev) =>
        prev.map((p) => (p.productId === productId ? { ...p, negotiatedPrice: null, negotiationId: null } : p)),
      ),
    syncNegotiations: (map) =>
      setItems((prev) =>
        prev.map((p) => {
          const n = map.get(p.productId);
          if (n) return { ...p, negotiatedPrice: n.price, negotiationId: n.id };
          if (p.negotiationId) return { ...p, negotiatedPrice: null, negotiationId: null };
          return p;
        }),
      ),
    count: items.reduce((n, i) => n + i.quantity, 0),
    total,
    originalTotal,
    savings: originalTotal - total,
    multiStore: isMultiStoreCart(items),
    bySeller,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}
