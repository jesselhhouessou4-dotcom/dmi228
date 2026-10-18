import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = { dish_id: string; name: string; price: number; image_url: string | null; quantity: number };

type Cart = {
  items: CartItem[];
  note: string;
  setNote: (n: string) => void;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<Cart | null>(null);

export function formatPrice(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [note, setNote] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dmi-cart");
      if (raw) {
        const p = JSON.parse(raw);
        setItems(p.items ?? []);
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
      const ex = prev.find((i) => i.dish_id === item.dish_id);
      if (ex) return prev.map((i) => (i.dish_id === item.dish_id ? { ...i, quantity: Math.min(99, i.quantity + qty) } : i));
      return [...prev, { ...item, quantity: qty }];
    });
  const setQty = (id: string, qty: number) =>
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.dish_id !== id) : prev.map((i) => (i.dish_id === id ? { ...i, quantity: Math.min(99, qty) } : i))));
  const clear = () => {
    setItems([]);
    setNote("");
  };
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return <CartContext.Provider value={{ items, note, setNote, add, setQty, clear, total, count }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart outside provider");
  return c;
}
