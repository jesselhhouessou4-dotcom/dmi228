const KEY = "dmi_last_orders";

export function getSavedOrders(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
export function saveOrderNumber(n: string) {
  const list = [n, ...getSavedOrders().filter((x) => x !== n)].slice(0, 5);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export const TRACK_STEPS = [
  { v: "nouvelle", l: "Reçue" },
  { v: "en_preparation", l: "En préparation" },
  { v: "en_livraison", l: "En livraison" },
  { v: "livrée", l: "Livrée" },
];
