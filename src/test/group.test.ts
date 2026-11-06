import { describe, expect, it } from "vitest";
import { groupSummary, groupUnitPrice, groupMinDate } from "@/lib/group";

const s = { enabled: true, min_items: 10, lead_hours: 24, discount_type: "percent", discount_value: 10 };

describe("commande groupée", () => {
  it("needs 10 articles before the discount applies", () => {
    const r = groupSummary([{ price: 1000, quantity: 9 }], s);
    expect(r.unlocked).toBe(false);
    expect(r.missing).toBe(1);
    expect(r.total).toBe(9000);
  });
  it("applies a 10 % discount at 10 articles", () => {
    const r = groupSummary([{ price: 1000, quantity: 10 }], s);
    expect(r.total).toBe(9000);
    expect(r.saved).toBe(1000);
  });
  it("fixed discount removes the amount per article", () => {
    expect(groupUnitPrice({ price: 1000, quantity: 1 }, { ...s, discount_type: "fixed", discount_value: 150 })).toBe(850);
  });
  it("dish group price wins and keeps extras", () => {
    expect(groupUnitPrice({ price: 1500, quantity: 1, group_price: 800, extras: [{ price: 250, quantity: 2 }] }, s)).toBe(1300);
  });
  it("blocks slots under 24 h", () => {
    expect(groupMinDate(s, 0).getTime()).toBe(24 * 3600_000);
  });
});
