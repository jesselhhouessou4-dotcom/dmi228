import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { groupSummary, type GroupSettings } from "@/lib/group";
import { useCart } from "@/lib/cart";

export function useGroupSettings() {
  return useQuery({
    queryKey: ["group-settings"],
    queryFn: async () => (await supabase.from("group_settings").select("*").eq("id", 1).maybeSingle()).data as (GroupSettings & { updated_at: string }) | null,
  });
}

/** Group pricing preview for the current cart; the server recomputes it on order. */
export function useCartGroup() {
  const cart = useCart();
  const { data: settings } = useGroupSettings();
  const ids = [...new Set(cart.items.map((i) => i.dish_id))].sort();
  const { data: prices } = useQuery({
    queryKey: ["group-prices", ids],
    enabled: ids.length > 0,
    queryFn: async () => (await supabase.from("dishes").select("id,group_price").in("id", ids)).data ?? [],
  });
  const lines = cart.items.map((i) => ({ ...i, group_price: prices?.find((p) => p.id === i.dish_id)?.group_price ?? null }));
  const summary = settings ? groupSummary(lines, settings) : null;
  const active = !!(cart.group && settings?.enabled);
  return { settings, lines, summary, active, applied: active && !!summary?.unlocked };
}
