export type GroupSettings = { enabled: boolean; min_items: number; lead_hours: number; discount_type: "percent" | "fixed" | string; discount_value: number };
export type GroupLine = { price: number; quantity: number; group_price?: number | null; extras?: { price: number; quantity: number }[] };

/** Mirrors the server rule in place_order_v5: dish group price wins, else % or fixed amount off per unit; never above the normal price. */
export function groupUnitPrice(line: GroupLine, s: GroupSettings) {
  let unit: number;
  if (line.group_price != null) unit = line.group_price + (line.extras ?? []).reduce((t, e) => t + e.price * e.quantity, 0);
  else if (s.discount_type === "percent") unit = Math.round((line.price * (100 - Math.min(s.discount_value, 100))) / 100);
  else unit = Math.max(0, line.price - s.discount_value);
  return Math.min(unit, line.price);
}

export function groupSummary(lines: GroupLine[], s: GroupSettings) {
  const count = lines.reduce((t, l) => t + l.quantity, 0);
  const original = lines.reduce((t, l) => t + l.price * l.quantity, 0);
  const unlocked = s.enabled && count >= s.min_items;
  const total = unlocked ? lines.reduce((t, l) => t + groupUnitPrice(l, s) * l.quantity, 0) : original;
  return { count, missing: Math.max(0, s.min_items - count), unlocked, original, total, saved: original - total };
}

export const groupMinDate = (s: GroupSettings, now = Date.now()) => new Date(now + s.lead_hours * 3600_000);
