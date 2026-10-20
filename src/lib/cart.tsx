import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = {
  key: string; dish_id: string; name: string; price: number; image_url: string | null;
  quantity: number; format?: string | null; category?: string;
};

type Cart = {
  items: CartItem[];
  note: string;
  setNote: (n: string) => void;
  add: (item: Omit<CartItem, "quantity" | "key">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  total: number;
  count: number;
  hasDrink: boolean;
};

const CartContext = createContext<Cart | null>(null);

export function formatPrice(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

export const itemKey = (dish_id: string, format?: string | null) => `${dish_id}::${format ?? ""}`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [note, setNote] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dmi-cart");
      if (raw) {
        const p = JSON.parse(raw);
        setItems((p.items ?? []).map((i: CartItem) => ({ ...i, key: i.key ?? itemKey(i.dish_id, i.format) })));
        setNote(p.note ?? "");
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem("dmi-cart", JSON.stringify({ items, note }));
  }, [items, note, loaded]);

  const add: Cart["add"] = (item, qty = 1) =>
    setItems((prev) => {
      const key = itemKey(item.dish_id, item.format);
      const ex = prev.find((i) => i.key === key);
      if (ex) return prev.map((i) => (i.key === key ? { ...i, quantity: Math.min(99, i.quantity + qty) } : i));
      return [...prev, { ...item, key, quantity: qty }];
    });
  const setQty = (key: string, qty: number) =>
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.key !== key) : prev.map((i) => (i.key === key ? { ...i, quantity: Math.min(99, qty) } : i))));
  const clear = () => { setItems([]); setNote(""); };
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const hasDrink = items.some((i) => i.category === "boisson");

  return <CartContext.Provider value={{ items, note, setNote, add, setQty, clear, total, count, hasDrink }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart outside provider");
  return c;
}
