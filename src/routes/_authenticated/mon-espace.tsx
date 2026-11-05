import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, RotateCcw, LogOut, Check, Inbox, Megaphone, ChefHat, Bike, PackageCheck, XCircle, ReceiptText, ChevronRight } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { getCustomerSpace } from "@/lib/customer.functions";
import { reorderItems } from "@/lib/reorder";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, useCart } from "@/lib/cart";
import { TRACK_STEPS } from "@/lib/orders";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Json } from "@/integrations/supabase/types";

const spaceOptions = (id: string) => queryOptions({ queryKey: ["customer-space", id], queryFn: () => getCustomerSpace(), refetchInterval: 5000 });
export const Route = createFileRoute("/_authenticated/mon-espace")({
  validateSearch: z.object({ tab: z.enum(["orders", "notifications", "profile"]).optional() }),
  loader: ({ context }) => context.queryClient.ensureQueryData(spaceOptions(context.user.id)),
  head: () => ({ meta: [ { title: "Mon espace — Don't mind it !" }, { name: "description", content: "Tes commandes, ton profil et tes notifications DMI." }, { property: "og:title", content: "Mon espace — Don't mind it !" }, { property: "og:description", content: "Retrouve tes commandes et tes notifications." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" } ] }),
  component: CustomerSpace,
});
type Line = { dish_id: string; name: string; quantity: number; price: number; format?: string | null; extras?: { id: string; name: string; price: number; quantity: number }[] };
function lines(value: Json): Line[] { return Array.isArray(value) ? value as unknown as Line[] : []; }
function CustomerSpace() {
  const { user } = Route.useRouteContext(); const { tab } = Route.useSearch();
  const { data } = useSuspenseQuery(spaceOptions(user.id)); const qc = useQueryClient(); const navigate = useNavigate(); const cart = useCart();
  const [name, setName] = useState(data.profile.name); const [location, setLocation] = useState(data.profile.usual_location);
  const [busy, setBusy] = useState<string | null>(null);
  const unread = data.notifications.filter(n => !n.read_at).length;
  async function signOut() { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); navigate({ to: "/connexion", replace: true }); }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy("profile");
    const { error } = await supabase.from("profiles").update({ name: name.trim(), usual_location: location.trim() }).eq("id", user.id);
    setBusy(null); if (error) { toast.error(error.message); return; }
    toast.success("Profil enregistré"); qc.invalidateQueries({ queryKey: ["customer-profile"] }); qc.invalidateQueries({ queryKey: ["customer-space"] });
  }
  async function read(id?: string) {
    let query = supabase.from("customer_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    if (id) query = query.eq("id", id);
    const { error } = await query; if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["customer-space"] }); qc.invalidateQueries({ queryKey: ["customer-unread"] });
  }
  async function reorder(id: string, items: Json) {
    setBusy(id);
    try {
      const { data: dishes, error } = await supabase.from("dishes").select("*").eq("published", true); if (error) throw error;
      const { data: extras } = await supabase.from("extras").select("id,name,price,is_available,categories,dish_ids").eq("is_available", true);
      const result = reorderItems(lines(items), (dishes ?? []).map(d => ({ ...d, formats: d.formats as { name: string; price: number }[] })), extras ?? []);
      if (!result.ready.length) { toast.error("Ces articles ne sont plus disponibles."); return; }
      if (cart.count && !window.confirm("Remplacer le panier actuel par cette commande ?")) return;
      cart.clear(); result.ready.forEach(({ quantity, ...item }) => cart.add(item, quantity));
      if (result.skipped) toast.warning(`${result.skipped} article(s) indisponible(s) non ajouté(s).`);
      else toast.success("Articles remis dans le panier, aux prix actuels.");
      navigate({ to: "/commande" });
    } catch { toast.error("Impossible de reprendre cette commande."); } finally { setBusy(null); }
  }
  return <div className="min-h-screen"><SiteHeader /><main className="mx-auto max-w-5xl px-4 py-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black">Mon espace</h1><p className="mt-1 text-muted-foreground">{data.profile.name || user.email}</p></div><Button variant="outline" onClick={signOut}><LogOut />Déconnexion</Button></div>
    <Tabs value={tab ?? "orders"} onValueChange={v => navigate({ to: "/mon-espace", search: { tab: z.enum(["orders", "notifications", "profile"]).parse(v) }, replace: true })} className="mt-6">
      <TabsList className="flex h-auto w-full justify-start overflow-x-auto sm:w-auto"><TabsTrigger value="orders">Mes commandes</TabsTrigger><TabsTrigger value="notifications"><Bell className="mr-1 h-4 w-4" />Notifications{unread > 0 ? ` (${unread})` : ""}</TabsTrigger><TabsTrigger value="profile">Mon profil</TabsTrigger></TabsList>
      <TabsContent value="orders">
        {!data.orders.length ? <div className="py-12"><p className="mb-5 text-muted-foreground">Tu n’as pas encore de commande associée à ton compte.</p><Button asChild><Link to="/menu">Commander</Link></Button></div> : <div className="mt-5 grid gap-4 md:grid-cols-2">{data.orders.map(o => <article key={o.id} className="rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><Button asChild variant="link" className="h-auto p-0 text-lg font-black"><Link to="/suivi" search={{ n: o.order_number ?? undefined }}>{o.order_number}</Link></Button><p className="mt-1 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("fr-FR")}</p></div><span className={o.status === "annulée" ? "font-bold text-destructive" : "font-bold text-primary"}>{TRACK_STEPS.find(s => s.v === o.status)?.l ?? "Annulée"}</span></div>
          <ul className="my-4 space-y-2 text-sm">{lines(o.items).map((i,k) => <li key={k}><div className="flex justify-between gap-3"><span>{i.quantity} × {i.name}</span><span className="shrink-0">{formatPrice(i.price * i.quantity)}</span></div>{i.extras?.map((e, j) => <p key={j} className="pl-4 text-xs text-muted-foreground">+ {e.quantity} × {e.name} ({formatPrice(e.price)})</p>)}</li>)}</ul>
          <div className="flex flex-wrap justify-between gap-2 border-t pt-3"><span className="text-sm">{o.payment_method === "cash" ? "Cash" : "Mobile money"}</span><strong>{formatPrice(o.total)}</strong></div>
          <div className="mt-4 flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/suivi" search={{ n: o.order_number ?? undefined }}>Détail et suivi</Link></Button><Button disabled={busy === o.id} onClick={() => reorder(o.id,o.items)}><RotateCcw />{busy === o.id ? "Patiente…" : "Recommander"}</Button></div>
        </article>)}</div>}
      </TabsContent>
      <TabsContent value="notifications"><div className="my-4 flex justify-end"><Button variant="outline" disabled={!unread} onClick={() => read()}><Check />Tout marquer comme lu</Button></div>
        <NotificationList notifications={data.notifications} orders={data.orders} onRead={read} />
      </TabsContent>
      <TabsContent value="profile"><form onSubmit={save} className="mt-6 max-w-lg space-y-4"><label className="block text-sm font-bold">Nom<Input required maxLength={100} value={name} onChange={e => setName(e.target.value)} className="mt-1 h-12" /></label><label className="block text-sm font-bold">Lieu habituel de livraison<Input maxLength={300} value={location} onChange={e => setLocation(e.target.value)} className="mt-1 h-12" /></label><p className="break-all text-sm text-muted-foreground">{user.email}</p><Button disabled={busy === "profile"}>Enregistrer mon profil</Button></form></TabsContent>
    </Tabs>
  </main></div>;
}