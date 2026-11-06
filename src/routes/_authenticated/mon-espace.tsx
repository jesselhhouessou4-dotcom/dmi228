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
      <TabsContent value="notifications">
        <NotificationList notifications={data.notifications} orders={data.orders} onRead={read} />
      </TabsContent>
      <TabsContent value="profile"><form onSubmit={save} className="mt-6 max-w-lg space-y-4"><label className="block text-sm font-bold">Nom<Input required maxLength={100} value={name} onChange={e => setName(e.target.value)} className="mt-1 h-12" /></label><label className="block text-sm font-bold">Lieu habituel de livraison<Input maxLength={300} value={location} onChange={e => setLocation(e.target.value)} className="mt-1 h-12" /></label><p className="break-all text-sm text-muted-foreground">{user.email}</p><Button disabled={busy === "profile"}>Enregistrer mon profil</Button></form></TabsContent>
    </Tabs>
  </main></div>;
}
type Notif = { id: string; title: string; message: string; read_at: string | null; created_at: string; order_id: string | null };
function notifKind(n: Notif) {
  const t = n.title.toLowerCase();
  if (!n.order_id) return { Icon: Megaphone, label: "Annonce", tone: "bg-accent text-accent-foreground" };
  if (t.includes("annul")) return { Icon: XCircle, label: "Annulée", tone: "bg-destructive/15 text-destructive" };
  if (t.includes("livrée")) return { Icon: PackageCheck, label: "Livrée", tone: "bg-primary/15 text-primary" };
  if (t.includes("livraison")) return { Icon: Bike, label: "En livraison", tone: "bg-primary/15 text-primary" };
  if (t.includes("préparation")) return { Icon: ChefHat, label: "En préparation", tone: "bg-secondary text-secondary-foreground" };
  return { Icon: ReceiptText, label: "Commande", tone: "bg-muted text-foreground" };
}
function ago(d: string) {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "à l’instant"; if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `il y a ${h} h`;
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function NotificationList({ notifications, orders, onRead }: { notifications: Notif[]; orders: { id: string; order_number: string | null }[]; onRead: (id?: string) => void }) {
  const [filter, setFilter] = useState<"all" | "unread" | "orders" | "news">("all");
  const unread = notifications.filter(n => !n.read_at).length;
  const shown = notifications.filter(n => filter === "unread" ? !n.read_at : filter === "orders" ? !!n.order_id : filter === "news" ? !n.order_id : true);
  const chips = [["all", "Toutes"], ["unread", `Non lues${unread ? ` · ${unread}` : ""}`], ["orders", "Commandes"], ["news", "Annonces"]] as const;
  return <div className="mt-4 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">{chips.map(([v, l]) => <button key={v} type="button" onClick={() => setFilter(v)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${filter === v ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>{l}</button>)}</div>
      <Button variant="outline" size="sm" disabled={!unread} onClick={() => onRead()}><Check />Tout lire</Button>
    </div>
    {!shown.length ? <div className="flex flex-col items-center rounded-2xl border border-dashed py-12 text-center text-muted-foreground"><Inbox className="mb-3 h-10 w-10" /><p>{filter === "unread" ? "Tout est lu, bravo !" : "Aucune notification ici pour le moment."}</p></div> :
    <ul className="space-y-3">{shown.map(n => { const k = notifKind(n); const num = orders.find(o => o.id === n.order_id)?.order_number; return <li key={n.id} className={`relative flex gap-3 rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md ${n.read_at ? "bg-card opacity-75" : "border-primary/40 bg-primary/5"}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${k.tone}`}><k.Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 pr-3"><div className="min-w-0"><span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${k.tone}`}>{k.label}</span><h2 className="mt-1 font-black leading-tight">{n.title}</h2></div><span className="shrink-0 text-xs text-muted-foreground">{ago(n.created_at)}</span></div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{n.message}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {n.order_id && <Button asChild size="sm"><Link to="/suivi" search={{ n: num ?? undefined }} onClick={() => onRead(n.id)}>Suivre {num}<ChevronRight /></Link></Button>}
          {!n.read_at && <Button variant="ghost" size="sm" onClick={() => onRead(n.id)}><Check />Marquer comme lu</Button>}
        </div>
      </div>
      {!n.read_at && <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-destructive" aria-label="Non lue" />}
    </li>; })}</ul>}
  </div>;
}
