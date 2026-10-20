export type DishFormat = { name: string; price: number };
export type Dish = {
  id: string; name: string; price: number; image_url: string | null;
  category: "plat" | "dessert" | "boisson"; ingredients: string | null;
  formats: DishFormat[]; is_available: boolean; featured: boolean; in_carousel: boolean;
  published?: boolean;
};
export const CATEGORIES = [
  { id: "plats", label: "Plats", cat: "plat" },
  { id: "desserts", label: "Desserts", cat: "dessert" },
  { id: "boissons", label: "Boissons", cat: "boisson" },
] as const;
export const categoryLabel = (c: string) => (c === "dessert" ? "Dessert" : c === "boisson" ? "Boisson" : "Plat");
export const DISH_COLUMNS = "id,name,price,image_url,category,ingredients,formats,is_available,featured,in_carousel";
