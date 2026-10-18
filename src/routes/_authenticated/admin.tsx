import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Pencil, Trash2, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPrice } from "@/lib/cart";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Espace admin — Don't mind it !" },
      { name: "description", content: "Gestion des plats et des commandes." },
      { property: "og:title", content: "Espace admin — Don't mind it !" },
      { property: "og:description", content: "Gestion des plats et des commandes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Dish = { id: string; name: string; price: number; image_url: string | null; published: boolean };
type OrderItem = { name: string; price: number; quantity: number };
type Order = {
  id: string; customer_name: string; delivery_time: string; delivery_location: string; payment_method: string;
  note: string | null; items: OrderItem[]; total: number; status: string; created_at: string;
};

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      return !!data;
    },
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const out = <button onClick={signOut} className="shrink-0 rounded-full bg-brand-foreground px-4 py-2 text-sm font-bold text-brand">Déconnexion</button>;

  if (isLoading) return <div className="min-h-screen"><SiteHeader right={out} /></div>;
  if (!isAdmin)
    return (
      <div className="min-h-screen"><SiteHeader right={out} />
        <p className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">Ce compte n'a pas accès à l'espace administrateur.</p>
      </div>
    );

  return (
    <div className="min-h-screen">
      <SiteHeader right={out} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-black">Espace admin</h1>
        <Tabs defaultValue="orders" className="mt-6">
          <TabsList className="rounded-full">
            <TabsTrigger value="orders" className="rounded-full">Commandes</TabsTrigger>
            <TabsTrigger value="dishes" className="rounded-full">Plats</TabsTrigger>
          </TabsList>
          <TabsContent value="orders"><Orders /></TabsContent>
          <TabsContent value="dishes"><Dishes /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Orders() {
  const qc = useQueryClient();
  const { data: orders } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as unknown as Order[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("orders-admin")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const o = payload.new as Order;
        toast.success(`Nouvelle commande de ${o.customer_name} — ${formatPrice(o.total)}`, { icon: <Bell className="h-4 w-4" /> });
        qc.invalidateQueries({ queryKey: ["orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const toggleStatus = async (o: Order) => {
    const status = o.status === "livrée" ? "nouvelle" : "livrée";
    await supabase.from("orders").update({ status }).eq("id", o.id);
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  if (!orders?.length) return <p className="mt-6 text-muted-foreground">Aucune commande pour le moment. Les nouvelles apparaîtront ici en temps réel.</p>;

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {orders.map((o) => (
        <div key={o.id} className={`rounded-[2rem] bg-card p-5 shadow-bubble ${o.status === "livrée" ? "opacity-60" : ""}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{o.customer_name}</p>
              <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("fr-FR")}</p>
            </div>
            <button onClick={() => toggleStatus(o)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${o.status === "livrée" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
              {o.status === "livrée" ? "Livrée" : "Marquer livrée"}
            </button>
          </div>
          <div className="mt-3 space-y-1 text-sm">
            {o.items.map((i, k) => <div key={k} className="flex justify-between"><span>{i.quantity} × {i.name}</span><span>{formatPrice(i.price * i.quantity)}</span></div>)}
          </div>
          {o.note && <p className="mt-2 rounded-xl bg-secondary p-2 text-sm">📝 {o.note}</p>}
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <p><b>Heure :</b> {o.delivery_time}</p>
            <p><b>Lieu :</b> {o.delivery_location}</p>
            <p><b>Paiement :</b> {o.payment_method === "cash" ? "Cash à la livraison" : "Mobile money (Mixx)"}</p>
            <p className="text-base font-bold">Total : {formatPrice(o.total)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Dishes() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Dish | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: dishes } = useQuery({
    queryKey: ["dishes", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dishes").select("*").order("created_at");
      if (error) throw error;
      return data as Dish[];
    },
  });

  const reset = () => { setEditing(null); setName(""); setPrice(""); setFile(null); };
  const refresh = () => qc.invalidateQueries({ queryKey: ["dishes"] });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(price, 10);
    if (!name.trim() || isNaN(p) || p < 0) { toast.error("Nom et prix requis"); return; }
    setSaving(true);
    let image_url = editing?.image_url ?? null;
    if (file) {
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
      const up = await supabase.storage.from("dishes").upload(path, file);
      if (up.error) { setSaving(false); return toast.error("Échec de l'envoi de l'image"); }
      const signed = await supabase.storage.from("dishes").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      image_url = signed.data?.signedUrl ?? null;
    }
    const payload = { name: name.trim(), price: p, image_url };
    const { error } = editing
      ? await supabase.from("dishes").update(payload).eq("id", editing.id)
      : await supabase.from("dishes").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Plat modifié" : "Plat ajouté");
    reset();
    refresh();
  };

  const remove = async (d: Dish) => {
    if (!confirm(`Supprimer « ${d.name} » ?`)) return;
    await supabase.from("dishes").delete().eq("id", d.id);
    refresh();
  };

  const togglePublished = async (d: Dish, v: boolean) => {
    await supabase.from("dishes").update({ published: v }).eq("id", d.id);
    refresh();
  };

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-[320px_1fr]">
      <form onSubmit={save} className="h-fit space-y-3 rounded-[2rem] bg-card p-5 shadow-bubble">
        <h2 className="text-xl font-black">{editing ? "Modifier le plat" : "Nouveau plat"}</h2>
        <Input placeholder="Nom" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
        <Input placeholder="Prix (FCFA)" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="h-11 rounded-xl" />
        <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="rounded-xl" />
        <button disabled={saving} className="h-11 w-full rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-60">{saving ? "Enregistrement…" : "Enregistrer"}</button>
        {editing && <button type="button" onClick={reset} className="w-full text-sm text-muted-foreground underline">Annuler</button>}
      </form>
      <div className="space-y-3">
        {dishes?.map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-bubble">
            {d.image_url ? <img src={d.image_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-secondary"><UtensilsCrossed className="h-5 w-5" /></div>}
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{d.name}</p>
              <p className="text-sm text-muted-foreground">{formatPrice(d.price)}</p>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-xs">
              <Switch checked={d.published} onCheckedChange={(v) => togglePublished(d, v)} />
              <span className="hidden sm:inline">{d.published ? "Publié" : "Masqué"}</span>
            </label>
            <button onClick={() => { setEditing(d); setName(d.name); setPrice(String(d.price)); setFile(null); }} className="shrink-0 rounded-full p-2 hover:bg-secondary" aria-label="Modifier"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => remove(d)} className="shrink-0 rounded-full p-2 text-destructive hover:bg-secondary" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
