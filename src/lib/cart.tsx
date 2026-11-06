import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { extrasSignature, unitPrice, type ChosenExtra } from "@/lib/extras";

export type CartItem = {
  key: string; dish_id: string; name: string;
  /** Unit price including extras. */
  price: number; base_price?: number; image_url: string | null;
  quantity: number; format?: string | null; category?: string; extras?: ChosenExtra[];
};

type Cart = {
  items: CartItem[];
  note: string;
  setNote: (n: string) => void;
  add: (item: Omit<CartItem, "quantity" | "key">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  setExtraQty: (key: string, extraId: string, qty: number) => void;
  clear: () => void;
  total: number;
  count: number;
  hasDrink: boolean;
  group: boolean;
  setGroup: (g: boolean) => void;
};

const CartContext = createContext<Cart | null>(null);

export function formatPrice(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

export const itemKey = (dish_id: string, format?: string | null, extras?: ChosenExtra[]) =>
  `${dish_id}::${format ?? ""}::${extrasSignature(extras)}`;

function withExtras(i: CartItem, extras: ChosenExtra[]): CartItem {
  const base = i.base_price ?? i.price;
  return { ...i, base_price: base, extras, price: unitPrice(base, extras), key: itemKey(i.dish_id, i.format, extras) };
}

function mergeLine(prev: CartItem[], line: CartItem) {
  const ex = prev.find((i) => i.key === line.key);
  if (ex) return prev.map((i) => (i.key === line.key ? { ...i, quantity: Math.min(99, i.quantity + line.quantity) } : i));
  return [...prev, line];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [note, setNote] = useState("");
  const [group, setGroup] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dmi-cart");
      if (raw) {
        const p = JSON.parse(raw);
        setItems((p.items ?? []).map((i: CartItem) => ({ ...i, key: itemKey(i.dish_id, i.format, i.extras) })));
        setNote(p.note ?? "");
        setGroup(!!p.group);
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem("dmi-cart", JSON.stringify({ items, note, group }));
  }, [items, note, group, loaded]);

  const add: Cart["add"] = (item, qty = 1) =>
    setItems((prev) => {
      const extras = (item.extras ?? []).filter((e) => e.quantity > 0);
      const base = item.base_price ?? item.price;
      return mergeLine(prev, { ...item, extras, base_price: base, price: unitPrice(base, extras), key: itemKey(item.dish_id, item.format, extras), quantity: qty });
    });
  const setQty = (key: string, qty: number) =>
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.key !== key) : prev.map((i) => (i.key === key ? { ...i, quantity: Math.min(99, qty) } : i))));
  const setExtraQty = (key: string, extraId: string, qty: number) =>
    setItems((prev) => {
      const line = prev.find((i) => i.key === key);
      if (!line) return prev;
      const extras = (line.extras ?? []).map((e) => (e.id === extraId ? { ...e, quantity: Math.min(10, qty) } : e)).filter((e) => e.quantity > 0);
      return mergeLine(prev.filter((i) => i.key !== key), withExtras(line, extras));
    });
  const clear = () => { setItems([]); setNote(""); setGroup(false); };
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const hasDrink = items.some((i) => i.category === "boisson");

  return <CartContext.Provider value={{ items, note, setNote, add, setQty, setExtraQty, clear, total, count, hasDrink, group, setGroup }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart outside provider");
  return c;
}
