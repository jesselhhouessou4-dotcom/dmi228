import { describe, expect, it } from "vitest";
import { extrasForDish, extrasSignature, unitPrice } from "@/lib/extras";

describe("suppléments", () => {
  it("le prix d'un plat inclut chaque supplément multiplié par sa quantité", () => {
    expect(unitPrice(1500, [{ id: "v", name: "Viande", price: 500, quantity: 2 }, { id: "o", name: "Œuf", price: 200, quantity: 1 }])).toBe(2700);
  });
  it("des suppléments différents donnent des lignes différentes", () => {
    expect(extrasSignature([{ id: "v", name: "", price: 0, quantity: 1 }])).not.toBe(extrasSignature([{ id: "v", name: "", price: 0, quantity: 2 }]));
  });
  it("seuls les suppléments disponibles et liés au plat ou à sa catégorie s'affichent", () => {
    const list = [
      { id: "a", name: "", price: 0, is_available: true, categories: [], dish_ids: ["d1"] },
      { id: "b", name: "", price: 0, is_available: true, categories: ["plat"], dish_ids: [] },
      { id: "c", name: "", price: 0, is_available: false, categories: ["plat"], dish_ids: [] },
      { id: "d", name: "", price: 0, is_available: true, categories: ["dessert"], dish_ids: [] },
    ];
    expect(extrasForDish(list, { id: "d1", category: "plat" }).map((e) => e.id)).toEqual(["a", "b"]);
  });
});
