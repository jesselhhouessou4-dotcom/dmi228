import type { CartItem } from "@/lib/cart";
type PastItem = { dish_id: string; quantity: number; format?: string | null };
type AvailableDish = { id: string; name: string; price: number; image_url: string | null; category: string; published: boolean; is_available: boolean; formats: { name: string; price: number }[] };
export function reorderItems(items: PastItem[], dishes: AvailableDish[]) {
  const ready: Omit<CartItem, "key">[] = [];
  let skipped = 0;
  for (const item of items) {
    const dish = dishes.find(d => d.id === item.dish_id && d.published && d.is_available);
    const format = dish?.formats.find(f => f.name === item.format);
    if (!dish || (item.format && !format) || (!item.format && dish.formats.length)) { skipped++; continue; }
    ready.push({ dish_id: dish.id, name: dish.name, price: format?.price ?? dish.price, image_url: dish.image_url, category: dish.category, format: item.format, quantity: Math.max(1, Math.min(99, item.quantity)) });
  }
  return { ready, skipped };
}