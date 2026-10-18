import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart, formatPrice } from "@/lib/cart";
import { SiteHeader } from "@/components/SiteHeader";
import { Input } from "@/components/ui/input";
import qr from "@/assets/mixx-qr.jpg.asset.json";

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

const schema = z.object({
  name: z.string().trim().min(1, "Indique ton nom").max(100),
  time: z.string().trim().min(1, "Indique l'heure souhaitée").max(50),
  location: z.string().trim().min(3, "Indique le lieu précis").max(300),
});

function CheckoutPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", time: "", location: "" });
  const [payment, setPayment] = useState<"mobile_money" | "cash" | null>(null);
  const [loading, setLoading] = useState(false);

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Formulaire invalide"); return; }
    if (!payment) { toast.error("Choisis un mode de paiement"); return; }
    setLoading(true);
    const { error } = await supabase.rpc("place_order", {
      _customer_name: parsed.data.name,
      _delivery_time: parsed.data.time,
      _delivery_location: parsed.data.location,
      _payment_method: payment,
      _note: cart.note,
      _items: cart.items.map((i) => ({ dish_id: i.dish_id, quantity: i.quantity })),
    });
    setLoading(false);
    if (error) { toast.error(error.message || "Impossible d'envoyer la commande"); return; }
    cart.clear();
    navigate({ to: "/confirmation", search: { p: payment } });
  };

  const choice = (active: boolean) =>
    `rounded-2xl border-2 p-4 text-left font-semibold transition ${active ? "border-primary bg-secondary" : "border-border bg-card"}`;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <form onSubmit={submit} className="mx-auto max-w-lg space-y-6 px-4 py-8">
        <h1 className="text-3xl font-black">Livraison</h1>
        <div className="space-y-4 rounded-[2rem] bg-card p-5 shadow-bubble">
          <Field label="Ton nom"><Input value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 rounded-xl" /></Field>
          <Field label="Heure de réception souhaitée"><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="h-12 rounded-xl" /></Field>
          <Field label="Lieu précis de livraison"><Input value={form.location} maxLength={300} placeholder="Quartier, rue, repère…" onChange={(e) => setForm({ ...form, location: e.target.value })} className="h-12 rounded-xl" /></Field>
        </div>

        <h2 className="text-2xl font-black">Paiement</h2>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className={choice(payment === "mobile_money")} onClick={() => setPayment("mobile_money")}>Mobile money</button>
          <button type="button" className={choice(payment === "cash")} onClick={() => setPayment("cash")}>Cash</button>
        </div>
        {payment === "mobile_money" && (
          <div className="rounded-[2rem] bg-card p-5 text-center shadow-bubble">
            <p className="font-semibold">Scanne le code QR Mixx</p>
            <img src={qr.url} alt="Code QR Mixx" className="mx-auto my-4 h-52 w-52 rounded-xl" />
            <p className="text-sm">Après le paiement, envoie la capture d'écran au <a href="tel:+22899848522" className="font-bold text-primary">99 84 85 22</a></p>
          </div>
        )}
        {payment === "cash" && <div className="rounded-2xl bg-secondary p-4 text-center font-semibold text-secondary-foreground">Vous paierez à la livraison</div>}

        <div className="rounded-[2rem] bg-card p-5 shadow-bubble">
          {cart.items.map((i) => (
            <div key={i.dish_id} className="flex justify-between py-1 text-sm"><span>{i.quantity} × {i.name}</span><span>{formatPrice(i.price * i.quantity)}</span></div>
          ))}
          {cart.note && <p className="mt-2 text-sm italic text-muted-foreground">« {cart.note} »</p>}
          <div className="mt-3 flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{formatPrice(cart.total)}</span></div>
        </div>

        <button disabled={loading} className="h-14 w-full rounded-full bg-primary text-lg font-bold text-primary-foreground disabled:opacity-60">
          {loading ? "Envoi…" : "Envoyer ma commande"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-semibold">{label}</span>{children}</label>;
}
