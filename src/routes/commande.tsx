import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarClock, Zap, Copy, GraduationCap, MapPin, Navigation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart, formatPrice } from "@/lib/cart";
import { SiteHeader } from "@/components/SiteHeader";
import { Input } from "@/components/ui/input";
import qr from "@/assets/mixx-qr.jpg.asset.json";
import { useServerFn } from "@tanstack/react-start";
import { notifyNewOrder } from "@/lib/telegram.functions";
import { saveOrderNumber } from "@/lib/orders";
import { useCustomer } from "@/lib/customer";
import { Button } from "@/components/ui/button";
import { useCartGroup } from "@/lib/group-pricing";
import { groupMinDate } from "@/lib/group";
import { GroupOrderPanel, GroupTotal } from "@/components/GroupOrderPanel";

export const Route = createFileRoute("/commande")({
  head: () => ({
    meta: [
      { title: "Finaliser ma commande — Don't mind it !" },
      { name: "description", content: "Indique tes infos de livraison et ton mode de paiement." },
      { property: "og:title", content: "Finaliser ma commande — Don't mind it !" },
      { property: "og:description", content: "Livraison et paiement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutPage,
});

const MIXX_NUMBER = "99848522";

const schema = z.object({
  name: z.string().trim().min(1, "Indique ton nom").max(100),
  phone: z.string().trim().regex(/^\+?[0-9 ]{8,20}$/, "Indique un numéro de téléphone valide"),
  email: z.union([z.literal(""), z.string().trim().email("Adresse e-mail invalide").max(255)]),
});

async function copy(text: string, label: string) {
  try { await navigator.clipboard.writeText(text); toast.success(`${label} copié`); } catch { toast.error("Copie impossible, note-le à la main"); }
}

function CheckoutPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const notify = useServerFn(notifyNewOrder);
  const { user, profile } = useCustomer();
  const [form, setForm] = useState({ name: "", phone: "", email: "" })
  const [otype, setOtype] = useState<"immediate" | "preorder" | null>(null);
  const [when, setWhen] = useState("");
  const { data: settings } = useQuery({ queryKey: ["shop-settings"], queryFn: async () => (await supabase.from("shop_settings").select("*").eq("id", 1).maybeSingle()).data });
  const immediateOpen = settings?.immediate_open ?? true;
  const lead = settings?.lead_minutes ?? 60;
  const grp = useCartGroup();
  const isGroup = grp.active;
  const minWhen = toLocalInput(isGroup && grp.settings ? groupMinDate(grp.settings) : new Date(Date.now() + lead * 60000));
  const [dtype, setDtype] = useState<"etudiant" | "externe" | null>(null);
  const [place, setPlace] = useState("");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "loading" | "error">("idle");
  const [payment, setPayment] = useState<"mobile_money" | "cash" | null>(null);
  const [noScan, setNoScan] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!user) return;
    setForm(previous => ({ ...previous, name: previous.name || profile?.name || "", email: previous.email || user.email || "" }));
    if (profile?.usual_location) setPlace(previous => previous || profile.usual_location);
  }, [user, profile]);

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="text-muted-foreground">Ton panier est vide.</p>
          <Link to="/menu" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">Voir le menu</Link>
        </div>
      </div>
    );
  }

  const locate = () => {
    if (!("geolocation" in navigator)) { setGeoState("error"); toast.error("Localisation indisponible, décris le lieu à la main"); return; }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoState("idle"); toast.success("Position trouvée"); },
      () => { setGeoState("error"); toast.error("Position refusée ou introuvable, décris le lieu à la main"); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };
  const mapLink = geo ? `https://www.google.com/maps?q=${geo.lat.toFixed(6)},${geo.lng.toFixed(6)}` : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Formulaire invalide"); return; }
    if (isGroup && grp.settings && grp.summary) {
      if (!grp.summary.unlocked) { toast.error(`Encore ${grp.summary.missing} articles pour débloquer le tarif groupé`); return; }
      if (!when) { toast.error("Choisis la date et l'heure de livraison de la commande groupée"); return; }
      if (new Date(when).getTime() < groupMinDate(grp.settings).getTime()) { toast.error(`La commande groupée doit être passée au moins ${grp.settings.lead_hours} h à l'avance`); return; }
      const hm = when.slice(11, 16);
      if (settings && (hm < settings.open_time.slice(0, 5) || hm > settings.close_time.slice(0, 5))) { toast.error(`Livraison entre ${settings.open_time.slice(0, 5)} et ${settings.close_time.slice(0, 5)}`); return; }
    } else {
    if (!otype) { toast.error("Choisis maintenant ou pré-commande"); return; }
    if (otype === "immediate" && !immediateOpen) { toast.error("Commandes immédiates fermées, choisis la pré-commande"); return; }
    if (otype === "preorder") {
      if (!when) { toast.error("Choisis la date et l'heure de livraison"); return; }
      if (new Date(when).getTime() < Date.now() + lead * 60000) { toast.error(`Choisis un horaire au moins ${lead} min à l'avance`); return; }
      const hm = when.slice(11, 16);
      if (settings && (hm < settings.open_time.slice(0, 5) || hm > settings.close_time.slice(0, 5))) { toast.error(`Livraison entre ${settings.open_time.slice(0, 5)} et ${settings.close_time.slice(0, 5)}`); return; }
    }
    }
    if (!dtype) { toast.error("Indique si tu es étudiant(e) ou externe"); return; }
    const p = place.trim();
    if (dtype === "etudiant" && p.length < 3) { toast.error("Indique le lieu précis sur le campus"); return; }
    if (dtype === "externe" && !geo && p.length < 3) { toast.error("Partage ta position ou décris le lieu"); return; }
    if (!payment) { toast.error("Choisis un mode de paiement"); return; }
    const location = dtype === "etudiant"
      ? `Étudiant(e) — ${p}`
      : `Externe — ${[p, mapLink].filter(Boolean).join(" — ")}`;
    setLoading(true);
    const { data: orderId, error } = await supabase.rpc("place_order_v5", {
      _order_type: isGroup ? "group" : otype!,
      _scheduled_at: isGroup || otype === "preorder" ? new Date(when).toISOString() : (null as unknown as string),
      _customer_name: parsed.data.name,
      _customer_phone: parsed.data.phone,
      _customer_email: parsed.data.email,
      _delivery_type: dtype,
      _delivery_location: location.slice(0, 600),
      _payment_method: payment,
      _note: cart.note,
      _items: cart.items.map((i) => ({ dish_id: i.dish_id, quantity: i.quantity, format: i.format ?? null, extras: (i.extras ?? []).map((e) => ({ id: e.id, quantity: e.quantity })) })),
    });
    let num: string | undefined;
    if (!error && orderId) {
      try { await notify({ data: { orderId: orderId as string } }); } catch (e) { console.error(e); }
      const { data: n } = await supabase.rpc("order_number_of", { _id: orderId as string });
      if (n) { num = n as string; saveOrderNumber(num); }
    }
    setLoading(false);
    if (error) { toast.error(error.message || "Impossible d'envoyer la commande"); return; }
    cart.clear();
    navigate({ to: "/confirmation", search: { p: payment, n: num } });
  };

  const payTotal = grp.applied && grp.summary ? grp.summary.total : cart.total;
  const choice = (active: boolean) =>
    `rounded-2xl border-2 p-4 text-left font-semibold transition ${active ? "border-primary bg-secondary" : "border-border bg-card"}`;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <form onSubmit={submit} className="mx-auto max-w-lg space-y-6 px-4 py-8">
        <h1 className="text-3xl font-black">Livraison</h1>
        {!user && <div className="border-l-4 border-primary pl-4 text-sm"><p>Un compte te permet de retrouver tes commandes et de recevoir des notifications. Tu peux aussi commander sans compte.</p><Button asChild variant="link" className="mt-1 p-0"><Link to="/connexion">Me connecter ou créer un compte</Link></Button></div>}
        <div className="space-y-4 rounded-[2rem] bg-card p-5 shadow-bubble">
          <Field label="Ton nom"><Input value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 rounded-xl" /></Field>
          <Field label="Ton numéro de téléphone"><Input type="tel" value={form.phone} maxLength={20} placeholder="90 00 00 00" onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12 rounded-xl" /></Field>
          <Field label="Ton e-mail (facultatif)"><Input type="email" value={form.email} maxLength={255} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-12 rounded-xl" /></Field>
        </div>

        <GroupOrderPanel />
        {isGroup ? (
          <div className="space-y-4 rounded-[2rem] bg-card p-5 shadow-bubble">
            <p className="font-bold">Commande groupée : date et heure de livraison (obligatoire)</p>
            <Field label={`Au moins ${grp.settings?.lead_hours ?? 24} h à l'avance${settings ? `, entre ${settings.open_time.slice(0, 5)} et ${settings.close_time.slice(0, 5)}` : ""}`}>
              <Input type="datetime-local" required min={minWhen} value={when} onChange={(e) => setWhen(e.target.value)} className="h-12 rounded-xl" />
            </Field>
            <p className="text-xs text-muted-foreground">Un seul paiement pour toute la commande.</p>
          </div>
        ) : (
        <div className="space-y-4 rounded-[2rem] bg-card p-5 shadow-bubble">
          <p className="font-bold">Tu veux être livré : maintenant ou plus tard (pré-commande) ?</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={!immediateOpen} className={`${choice(otype === "immediate")} disabled:opacity-50`} onClick={() => setOtype("immediate")}><Zap className="mb-1 h-5 w-5" />Maintenant</button>
            <button type="button" className={choice(otype === "preorder")} onClick={() => setOtype("preorder")}><CalendarClock className="mb-1 h-5 w-5" />Pré-commande</button>
          </div>
          {!immediateOpen && <p className="rounded-xl bg-secondary p-3 text-sm font-semibold">Les commandes immédiates sont fermées pour le moment. Tu peux pré-commander.</p>}
          {otype === "immediate" && <p className="rounded-xl bg-secondary p-3 text-sm font-semibold">Ta commande sera préparée dès maintenant.</p>}
          {otype === "preorder" && (
            <Field label={`Date et heure de livraison${settings ? ` (entre ${settings.open_time.slice(0, 5)} et ${settings.close_time.slice(0, 5)})` : ""}`}>
              <Input type="datetime-local" min={minWhen} value={when} onChange={(e) => setWhen(e.target.value)} className="h-12 rounded-xl" />
            </Field>
          )}
        </div>
        )}

        <div className="space-y-4 rounded-[2rem] bg-card p-5 shadow-bubble">
          <p className="font-bold">Où te livrer ?</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className={choice(dtype === "etudiant")} onClick={() => setDtype("etudiant")}><GraduationCap className="mb-1 h-5 w-5" />Je suis étudiant(e)</button>
            <button type="button" className={choice(dtype === "externe")} onClick={() => setDtype("externe")}><MapPin className="mb-1 h-5 w-5" />Je suis externe</button>
          </div>
          {dtype === "etudiant" && (
            <Field label="Lieu sur le campus"><Input value={place} maxLength={300} placeholder="Bâtiment, salle, amphi, repère…" onChange={(e) => setPlace(e.target.value)} className="h-12 rounded-xl" /></Field>
          )}
          {dtype === "externe" && (
            <div className="space-y-3">
              <button type="button" onClick={locate} disabled={geoState === "loading"} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-60">
                <Navigation className="h-4 w-4" /> {geoState === "loading" ? "Recherche…" : geo ? "Position enregistrée ✓ (actualiser)" : "Utiliser ma position"}
              </button>
              {geo && <a href={mapLink} target="_blank" rel="noreferrer" className="block text-center text-sm font-semibold text-primary underline">Voir sur la carte</a>}
              {geoState === "error" && <p className="text-sm text-destructive">Position indisponible : décris le lieu ci-dessous.</p>}
              <Field label={geo ? "Précisions (facultatif)" : "Lieu précis de livraison"}><Input value={place} maxLength={300} placeholder="Quartier, maison, portail, repère…" onChange={(e) => setPlace(e.target.value)} className="h-12 rounded-xl" /></Field>
            </div>
          )}
        </div>

        <h2 className="text-2xl font-black">Paiement</h2>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className={choice(payment === "mobile_money")} onClick={() => setPayment("mobile_money")}>Mobile money</button>
          <button type="button" className={choice(payment === "cash")} onClick={() => setPayment("cash")}>Cash</button>
        </div>
        {payment === "mobile_money" && (
          <div className="space-y-4 rounded-[2rem] bg-card p-5 text-center shadow-bubble">
            <p className="rounded-xl bg-destructive/10 p-3 text-sm font-bold text-destructive">⚠️ Merci d'inclure les frais de retrait/transfert lors de votre envoi.</p>
            <p className="font-semibold">Scanne le code QR Mixx</p>
            <img src={qr.url} alt="Code QR Mixx" className="mx-auto h-52 w-52 rounded-xl" />
            <button type="button" onClick={() => setNoScan((s) => !s)} className="text-sm font-bold text-primary underline">Je ne peux pas scanner</button>
            {noScan && (
              <div className="space-y-3 rounded-2xl bg-secondary p-4 text-left text-secondary-foreground">
                <CopyRow label="Numéro Mixx" value="99 84 85 22" raw={MIXX_NUMBER} />
                <CopyRow label="Montant exact" value={formatPrice(payTotal)} raw={String(payTotal)} />
                <p className="text-xs font-semibold">+ les frais de transfert à ajouter</p>
                <a href="tel:*145%23" className="flex h-11 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">Ouvrir Mixx (*145#)</a>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  <li>Ouvre l'application Mixx ou compose *145#.</li>
                  <li>Choisis « Transfert d'argent » et colle le numéro 99 84 85 22.</li>
                  <li>Entre le montant exact plus les frais, puis valide.</li>
                  <li>Envoie la capture du paiement au 99 84 85 22.</li>
                </ol>
              </div>
            )}
            <p className="text-sm">Après le paiement, envoie la capture d'écran au <a href="tel:+22899848522" className="font-bold text-primary">99 84 85 22</a></p>
          </div>
        )}
        {payment === "cash" && <div className="rounded-2xl bg-secondary p-4 text-center font-semibold text-secondary-foreground">Vous paierez à la livraison</div>}

        <div className="rounded-[2rem] bg-card p-5 shadow-bubble">
          {cart.items.map((i) => (
            <div key={i.key} className="py-1 text-sm">
              <div className="flex justify-between gap-2"><span>{i.quantity} × {i.name}</span><span className="shrink-0">{grp.applied && (grp.groupUnit(i.key) ?? i.price) < i.price ? <><s className="text-muted-foreground">{formatPrice(i.price * i.quantity)}</s> {formatPrice((grp.groupUnit(i.key) ?? i.price) * i.quantity)}</> : formatPrice(i.price * i.quantity)}</span></div>
              {i.extras?.map((e) => <p key={e.id} className="pl-4 text-xs text-muted-foreground">+ {e.quantity} × {e.name} ({formatPrice(e.price)})</p>)}
            </div>
          ))}
          {cart.note && <p className="mt-2 text-sm italic text-muted-foreground">« {cart.note} »</p>}
          <div className="mt-3 flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><GroupTotal /></div>
          {grp.applied && grp.summary && <p className="mt-1 text-right text-sm font-bold text-primary">Total économisé : {formatPrice(grp.summary.saved)}</p>}
        </div>

        <button disabled={loading} className="h-14 w-full rounded-full bg-primary text-lg font-bold text-primary-foreground disabled:opacity-60">
          {loading ? "Envoi…" : "Envoyer ma commande"}
        </button>
      </form>
    </div>
  );
}

function CopyRow({ label, value, raw }: { label: string; value: string; raw: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div><p className="text-xs">{label}</p><p className="text-lg font-black">{value}</p></div>
      <button type="button" onClick={() => copy(raw, label)} className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-2 text-xs font-bold"><Copy className="h-3 w-3" /> Copier</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-semibold">{label}</span>{children}</label>;
}

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
