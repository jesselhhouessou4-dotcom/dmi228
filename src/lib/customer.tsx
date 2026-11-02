import { useQuery } from "@tanstack/react-query";
import { useHydrated } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export function useCustomer() {
  const hydrated = useHydrated();
  const { data: user } = useQuery({ queryKey: ["customer-session"], enabled: hydrated, queryFn: async () => {
    const { data } = await supabase.auth.getUser(); return data.user;
  }});
  const { data: profile } = useQuery({ queryKey: ["customer-profile", user?.id], enabled: !!user, queryFn: async () => {
    if (!user) return null;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (error) throw error; return data;
  }});
  const { data: unread = 0 } = useQuery({ queryKey: ["customer-unread", user?.id], enabled: !!user, refetchInterval: 5000, queryFn: async () => {
    if (!user) return 0;
    const { count, error } = await supabase.from("customer_notifications").select("id", { count: "exact", head: true }).eq("user_id",user.id).is("read_at",null);
    if (error) throw error; return count ?? 0;
  }});
  return { user, profile, unread };
}