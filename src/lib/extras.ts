export type Extra = { id: string; name: string; price: number; is_available: boolean; categories: string[]; dish_ids: string[] };
export type ChosenExtra = { id: string; name: string; price: number; quantity: number };

/** Extras an admin made available for this dish (by dish or by category). */
export function extrasForDish(extras: Extra[], dish: { id: string; category: string }) {
  return extras.filter((e) => e.is_available && (e.dish_ids.includes(dish.id) || e.categories.includes(dish.category)));
}

/** Price of one dish unit with its extras (extras count for each unit ordered). */
export function unitPrice(base: number, extras: ChosenExtra[] = []) {
  return base + extras.reduce((s, e) => s + e.price * e.quantity, 0);
}

export function extrasSignature(extras: ChosenExtra[] = []) {
  return extras.filter((e) => e.quantity > 0).map((e) => `${e.id}x${e.quantity}`).sort().join(",");
}

export function extrasText(extras?: ChosenExtra[] | null) {
  return (extras ?? []).map((e) => `+ ${e.quantity > 1 ? `${e.quantity} × ` : ""}${e.name}`);
}
