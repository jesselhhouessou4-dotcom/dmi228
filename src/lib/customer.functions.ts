import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCustomerSpace = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [orders, notifications, profile] = await Promise.all([
    context.supabase.from("orders").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }),
    context.supabase.from("customer_notifications").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }),
    context.supabase.from("profiles").select("*").eq("id", context.userId).single(),
  ]);
  if (orders.error) throw orders.error;
  if (notifications.error) throw notifications.error;
  if (profile.error) throw profile.error;
  return { orders: orders.data, notifications: notifications.data, profile: profile.data };
});