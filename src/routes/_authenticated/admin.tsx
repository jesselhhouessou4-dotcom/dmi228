import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, Pencil, Plus, Trash2, UtensilsCrossed, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPrice } from "@/lib/cart";
import { categoryLabel, type DishFormat } from "@/lib/dishes";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Espace admin — Don't mind it !" },
      { name: "description", content: "Gestion des articles, commandes et horaires." },
      { property: "og:title", content: "Espace admin — Don't mind it !" },
      { property: "og:description", content: "Gestion des articles, commandes et horaires." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Cat = "plat" | "dessert" | "boisson";
type Dish = {
  id: string; name: string; price: number; image_url: string | null; published: boolean; category: Cat;
  ingredients: string | null; formats: DishFormat[]; is_available: boolean; featured: boolean; in_carousel: boolean;
};
type OrderItem = { name: string; price: number; quantity: number; format?: string | null };
type Order = {
  id: string; customer_name: string; delivery_time: string; delivery_location: string; payment_method: string;
  customer_phone: string | null; customer_email: string | null; order_type: string; scheduled_at: string | null;
  note: string | null; items: OrderItem[]; total: number; status: string; created_at: string;
  order_number: string | null; cancel_reason: string | null; cancelled_by: string | null;
};

const STATUSES = [
  { v: "nouvelle", l: "Nouvelle" },
  { v: "en_preparation", l: "En préparation" },
  { v: "en_livraison", l: "En livraison" },
  { v: "livrée", l: "Livrée" },
  { v: "annulée", l: "Annulée" },
];

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
          <TabsList className="h-auto flex-wrap rounded-3xl">
            <TabsTrigger value="orders" className="rounded-full">Commandes</TabsTrigger>
            <TabsTrigger value="dishes" className="rounded-full">Articles</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-full">Horaires</TabsTrigger>
            <TabsTrigger value="admins" className="rounded-full">Admins</TabsTrigger>
          </TabsList>
          <TabsContent value="orders"><Orders /></TabsContent>
          <TabsContent value="dishes"><Dishes /></TabsContent>
          <TabsContent value="settings"><Settings /></TabsContent>
          <TabsContent value="admins"><Admins myId={user.id} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

const fmtDate = (s: string) => new Date(s).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

function Orders() {
  const qc = useQueryClient();
  const { data: orders } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data as unknown as Order[];
    },
  });
  const [fStatus, setFStatus] = useState("all");
  const [fType, setFType] = useState("all");
  const [fDate, setFDate] = useState("");

  const [soundOn, setSoundOn] = useState(false);
  const enableAlerts = async () => {
    playChime();
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    setSoundOn(true);
    toast.success("Alertes activées");
  };

  useEffect(() => {
    const ch = supabase
      .channel("orders-admin")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const o = payload.new as Order;
        const msg = `Nouvelle commande de ${o.customer_name} — ${formatPrice(o.total)}`;
        toast.success(msg, { icon: <Bell className="h-4 w-4" />, duration: 15000 });
        playChime();
        navigator.vibrate?.([300, 150, 300]);
        if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
          try { new Notification("Don't mind it ! — Nouvelle commande", { body: msg, icon: "/favicon.png" }); } catch { /* mobile may block */ }
        }
        qc.invalidateQueries({ queryKey: ["orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const list = useMemo(() => {
    let l = (orders ?? []).filter((o) =>
      (fStatus === "all" || o.status === fStatus) &&
      (fType === "all" || o.order_type === fType) &&
      (!fDate || (o.scheduled_at ?? o.created_at).slice(0, 10) === fDate));
    if (fType === "preorder") l = [...l].sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
    return l;
  }, [orders, fStatus, fType, fDate]);

  const cancelFn = useServerFn(notifyCancel);
  const setStatus = async (o: Order, status: string) => {
    let patch: { status: string; cancel_reason?: string | null; cancelled_by?: string } = { status };
    if (status === "annulée") {
      const r = window.prompt("Motif d'annulation (visible par le client) :", "");
      if (r === null) return;
      patch = { status, cancel_reason: r.trim().slice(0, 300) || null, cancelled_by: "admin" };
    }
    const { error } = await supabase.from("orders").update(patch).eq("id", o.id);
    if (error) toast.error(error.message);
    else if (status === "annulée" && o.order_number) { try { await cancelFn({ data: { orderNumber: o.order_number } }); } catch { /* ignore */ } }
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  const sel = "h-10 rounded-full border bg-card px-3 text-sm font-semibold";

  return (
    <div>
      <button onClick={enableAlerts} className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${soundOn ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"}`}>
        <Bell className="h-4 w-4" /> {soundOn ? "Alertes sonores actives" : "Activer les alertes sonores"}
      </button>
      <div className="mt-4 flex flex-wrap gap-2">
        <select aria-label="Filtrer par statut" value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={sel}>
          <option value="all">Tous les statuts</option>
          {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
        <select aria-label="Filtrer par type" value={fType} onChange={(e) => setFType(e.target.value)} className={sel}>
          <option value="all">Tous les types</option>
          <option value="immediate">Immédiates</option>
          <option value="preorder">Pré-commandes</option>
        </select>
        <input aria-label="Filtrer par date" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className={sel} />
        {(fStatus !== "all" || fType !== "all" || fDate) && <button onClick={() => { setFStatus("all"); setFType("all"); setFDate(""); }} className="text-sm underline">Effacer</button>}
      </div>
      {!list.length ? <p className="mt-6 text-muted-foreground">Aucune commande à afficher. Les nouvelles apparaîtront ici en temps réel.</p> : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {list.map((o) => (
            <div key={o.id} className={`rounded-[2rem] bg-card p-5 shadow-bubble ${o.status === "livrée" || o.status === "annulée" ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-black ${o.order_type === "preorder" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}`}>
                    {o.order_type === "preorder" ? `PRÉ-COMMANDE${o.scheduled_at ? ` · ${fmtDate(o.scheduled_at)}` : ""}` : "IMMÉDIATE"}
                  </span>
                  <p className="mt-1 truncate text-lg font-bold">{o.order_number ? `${o.order_number} · ` : ""}{o.customer_name}</p>
                  <p className="text-xs text-muted-foreground">Reçue le {fmtDate(o.created_at)}</p>
                  {o.status === "annulée" && <p className="text-xs font-bold text-destructive">Annulée par {o.cancelled_by === "client" ? "le client" : "l'équipe"}{o.cancel_reason ? ` — ${o.cancel_reason}` : ""}</p>}
                </div>
                <select aria-label="Statut" value={o.status} onChange={(e) => setStatus(o, e.target.value)} className="h-9 shrink-0 rounded-full border bg-secondary px-2 text-xs font-bold">
                  {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                {o.items.map((i, k) => <div key={k} className="flex justify-between"><span>{i.quantity} × {i.name}{i.format && !i.name.includes(i.format) ? ` (${i.format})` : ""}</span><span>{formatPrice(i.price * i.quantity)}</span></div>)}
              </div>
              {o.note && <p className="mt-2 rounded-xl bg-secondary p-2 text-sm">📝 {o.note}</p>}
              <div className="mt-3 space-y-1 border-t pt-3 text-sm">
                {o.customer_phone && <p><b>Tél :</b> <a href={`tel:${o.customer_phone.replace(/\s/g, "")}`} className="font-bold text-primary">{o.customer_phone}</a></p>}
                {o.customer_email && <p className="truncate"><b>E-mail :</b> {o.customer_email}</p>}
                <p className="break-words"><b>Lieu :</b> {o.delivery_location}</p>
                <p><b>Paiement :</b> {o.payment_method === "cash" ? "Cash à la livraison" : "Mobile money (Mixx)"}</p>
                <p className="text-base font-bold">Total : {formatPrice(o.total)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1175, 1568].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = f; o.type = "sine";
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.55);
    });
  } catch { /* audio unavailable */ }
}

function Dishes() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Dish | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<Cat>("plat");
  const [ingredients, setIngredients] = useState("");
  const [formats, setFormats] = useState<{ name: string; price: string }[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [fCat, setFCat] = useState<"all" | Cat>("all");

  const { data: dishes } = useQuery({
    queryKey: ["dishes", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dishes").select("*").order("created_at");
      if (error) throw error;
      return data as unknown as Dish[];
    },
  });

  const reset = () => { setEditing(null); setName(""); setPrice(""); setCategory("plat"); setIngredients(""); setFormats([]); setFile(null); };
  const refresh = () => qc.invalidateQueries({ queryKey: ["dishes"] });

  const startEdit = (d: Dish) => {
    setEditing(d); setName(d.name); setPrice(String(d.price)); setCategory(d.category); setIngredients(d.ingredients ?? "");
    setFormats((d.formats ?? []).map((f) => ({ name: f.name, price: String(f.price) }))); setFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const fmts = formats.filter((f) => f.name.trim()).map((f) => ({ name: f.name.trim().slice(0, 40), price: parseInt(f.price, 10) }));
    if (fmts.some((f) => isNaN(f.price) || f.price < 0)) { toast.error("Chaque format doit avoir un prix"); return; }
    let p = parseInt(price, 10);
    if (fmts.length && isNaN(p)) p = Math.min(...fmts.map((f) => f.price));
    if (!name.trim() || isNaN(p) || p < 0) { toast.error("Nom et prix requis"); return; }
    setSaving(true);
    let image_url = editing?.image_url ?? null;
    if (file) {
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
      const up = await supabase.storage.from("dishes").upload(path, file);
      if (up.error) { setSaving(false); toast.error("Échec de l'envoi de l'image"); return; }
      const signed = await supabase.storage.from("dishes").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      image_url = signed.data?.signedUrl ?? null;
    }
    const payload = { name: name.trim(), price: p, image_url, category, ingredients: ingredients.trim() || null, formats: fmts };
    const { error } = editing
      ? await supabase.from("dishes").update(payload).eq("id", editing.id)
      : await supabase.from("dishes").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Article modifié" : "Article ajouté");
    reset();
    refresh();
  };

  const remove = async (d: Dish) => {
    if (!confirm(`Supprimer « ${d.name} » ?`)) return;
    await supabase.from("dishes").delete().eq("id", d.id);
    refresh();
  };

  const toggle = async (d: Dish, field: "published" | "is_available" | "featured" | "in_carousel", v: boolean) => {
    const { error } = await supabase.from("dishes").update({ [field]: v } as { published: boolean }).eq("id", d.id);
    if (error) toast.error(error.message);
    refresh();
  };

  const shown = (dishes ?? []).filter((d) => fCat === "all" || d.category === fCat);

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-[340px_1fr]">
      <form onSubmit={save} className="h-fit space-y-3 rounded-[2rem] bg-card p-5 shadow-bubble">
        <h2 className="text-xl font-black">{editing ? "Modifier l'article" : "Nouvel article"}</h2>
        <Input placeholder="Nom" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
        <div>
          <p className="mb-1 text-sm font-semibold">Catégorie</p>
          <div className="grid grid-cols-3 gap-2">
            {(["plat", "dessert", "boisson"] as const).map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} className={`h-10 rounded-full border-2 text-sm font-bold ${category === c ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                {categoryLabel(c)}
              </button>
            ))}
          </div>
        </div>
        <Input placeholder={formats.length ? "Prix de base (facultatif)" : "Prix (FCFA)"} type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="h-11 rounded-xl" />
        <div className="space-y-2">
          <p className="text-sm font-semibold">Formats & prix {category === "boisson" ? "(ex. 33cl, 50cl, 1L)" : "(facultatif)"}</p>
          {formats.map((f, k) => (
            <div key={k} className="flex gap-2">
              <Input placeholder="Format" value={f.name} maxLength={40} onChange={(e) => setFormats(formats.map((x, j) => j === k ? { ...x, name: e.target.value } : x))} className="h-10 rounded-xl" />
              <Input placeholder="Prix" type="number" min={0} value={f.price} onChange={(e) => setFormats(formats.map((x, j) => j === k ? { ...x, price: e.target.value } : x))} className="h-10 w-24 rounded-xl" />
              <button type="button" aria-label="Retirer le format" onClick={() => setFormats(formats.filter((_, j) => j !== k))} className="rounded-full p-2 hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => setFormats([...formats, { name: "", price: "" }])} className="inline-flex items-center gap-1 text-sm font-bold text-primary"><Plus className="h-4 w-4" /> Ajouter un format</button>
        </div>
        <Textarea placeholder="Ingrédients (ex. riz, tomate, poulet…)" value={ingredients} maxLength={1000} onChange={(e) => setIngredients(e.target.value)} className="rounded-xl" />
        <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="rounded-xl" />
        <button disabled={saving} className="h-11 w-full rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-60">{saving ? "Enregistrement…" : "Enregistrer"}</button>
        {editing && <button type="button" onClick={reset} className="w-full text-sm text-muted-foreground underline">Annuler</button>}
      </form>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "plat", "dessert", "boisson"] as const).map((c) => (
            <button key={c} onClick={() => setFCat(c)} className={`rounded-full px-3 py-1 text-sm font-bold ${fCat === c ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{c === "all" ? "Tous" : categoryLabel(c) + "s"}</button>
          ))}
        </div>
        {shown.map((d) => (
          <div key={d.id} className="rounded-2xl bg-card p-3 shadow-bubble">
            <div className="flex items-center gap-3">
              {d.image_url ? <img src={d.image_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-secondary"><UtensilsCrossed className="h-5 w-5" /></div>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{d.name}</p>
                <p className="text-sm text-muted-foreground">
                  {d.formats?.length ? d.formats.map((f) => `${f.name} ${formatPrice(f.price)}`).join(" · ") : formatPrice(d.price)} · {categoryLabel(d.category)}
                </p>
              </div>
              <button onClick={() => startEdit(d)} className="shrink-0 rounded-full p-2 hover:bg-secondary" aria-label="Modifier"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => remove(d)} className="shrink-0 rounded-full p-2 text-destructive hover:bg-secondary" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <Toggle label={d.published ? "Publié" : "Masqué"} checked={d.published} onChange={(v) => toggle(d, "published", v)} />
              <Toggle label={d.is_available ? "Disponible" : "Épuisé"} checked={d.is_available} onChange={(v) => toggle(d, "is_available", v)} />
              <Toggle label="Plat du moment" checked={d.featured} onChange={(v) => toggle(d, "featured", v)} />
              <Toggle label="Carrousel" checked={d.in_carousel} onChange={(v) => toggle(d, "in_carousel", v)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center gap-2 font-semibold"><Switch checked={checked} onCheckedChange={onChange} />{label}</label>;
}

function Settings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["shop-settings"],
    queryFn: async () => (await supabase.from("shop_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [form, setForm] = useState<{ open: string; close: string; lead: string } | null>(null);
  useEffect(() => {
    if (data && !form) setForm({ open: data.open_time.slice(0, 5), close: data.close_time.slice(0, 5), lead: String(data.lead_minutes) });
  }, [data, form]);
  if (!data || !form) return null;

  const update = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from("shop_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) { toast.error(error.message); return false; }
    qc.invalidateQueries({ queryKey: ["shop-settings"] });
    return true;
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const lead = parseInt(form.lead, 10);
    if (isNaN(lead) || lead < 0 || lead > 1440) { toast.error("Délai entre 0 et 1440 minutes"); return; }
    if (form.open >= form.close) { toast.error("L'ouverture doit être avant la fermeture"); return; }
    if (await update({ open_time: form.open, close_time: form.close, lead_minutes: lead })) toast.success("Horaires enregistrés");
  };

  return (
    <div className="mt-4 max-w-md space-y-4">
      <div className="flex items-center justify-between rounded-[2rem] bg-card p-5 shadow-bubble">
        <div>
          <p className="font-bold">Commandes immédiates</p>
          <p className="text-sm text-muted-foreground">{data.immediate_open ? "Ouvert" : "Fermé — seule la pré-commande est possible"}</p>
        </div>
        <Switch checked={data.immediate_open} onCheckedChange={(v) => update({ immediate_open: v })} />
      </div>
      <form onSubmit={save} className="space-y-3 rounded-[2rem] bg-card p-5 shadow-bubble">
        <p className="font-bold">Horaires de livraison des pré-commandes</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold">Ouverture<Input type="time" value={form.open} onChange={(e) => setForm({ ...form, open: e.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          <label className="text-sm font-semibold">Fermeture<Input type="time" value={form.close} onChange={(e) => setForm({ ...form, close: e.target.value })} className="mt-1 h-11 rounded-xl" /></label>
        </div>
        <label className="block text-sm font-semibold">Délai minimum avant livraison (minutes)<Input type="number" min={0} max={1440} value={form.lead} onChange={(e) => setForm({ ...form, lead: e.target.value })} className="mt-1 h-11 rounded-xl" /></label>
        <button className="h-11 w-full rounded-full bg-primary font-bold text-primary-foreground">Enregistrer</button>
      </form>
    </div>
  );
}

function Admins({ myId }: { myId: string }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const { data } = useQuery({
    queryKey: ["admins"],
    queryFn: async () => { const { data, error } = await supabase.rpc("admin_list"); if (error) throw error; return data; },
  });
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.rpc("admin_add", { _email: email.trim() });
    if (error) { toast.error(error.message.includes("not found") ? "Ce compte doit d'abord s'inscrire" : error.message); return; }
    toast.success("Administrateur ajouté"); setEmail(""); qc.invalidateQueries({ queryKey: ["admins"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Retirer cet administrateur ?")) return;
    const { error } = await supabase.rpc("admin_remove", { _user_id: id });
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admins"] });
  };
  return (
    <div className="mt-4 max-w-md space-y-4">
      <form onSubmit={add} className="flex gap-2">
        <Input type="email" required placeholder="E-mail du collaborateur" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
        <button className="shrink-0 rounded-full bg-primary px-4 font-bold text-primary-foreground">Ajouter</button>
      </form>
      <p className="text-xs text-muted-foreground">Le collaborateur doit d'abord créer son compte sur /auth.</p>
      {data?.map((a) => (
        <div key={a.user_id} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-bubble">
          <span className="truncate text-sm font-semibold">{a.email}{a.user_id === myId ? " (vous)" : ""}</span>
          {a.user_id !== myId && <button onClick={() => remove(a.user_id)} aria-label="Retirer" className="rounded-full p-2 text-destructive hover:bg-secondary"><Trash2 className="h-4 w-4" /></button>}
        </div>
      ))}
    </div>
  );
}
