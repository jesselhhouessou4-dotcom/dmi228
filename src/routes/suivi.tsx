import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/cart";
import { getSavedOrders, TRACK_STEPS } from "@/lib/orders";
import { notifyCancel } from "@/lib/telegram.functions";

export const Route = createFileRoute("/suivi")({
  validateSearch: z.object({ n: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Suivre ma commande — Don't mind it !" },
      { name: "description", content: "Suis l'état de ta commande en direct avec ton numéro DMI." },
      { property: "og:title", content: "Suivre ma commande — Don't mind it !" },
      { property: "og:description", content: "Suis ta commande en direct." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Suivi,
});

type Item = { name: string; quantity: number; price: number; format?: string | null; extras?: { name: string; price: number; quantity: number }[] };

function Suivi() {
  const { n } = Route.useSearch();
  const navigate = useNavigate();
  const [input, setInput] = useState(n ?? "");
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    const s = getSavedOrders();
    setSaved(s);
    if (!n && s[0]) navigate({ to: "/suivi", search: { n: s[0] }, replace: true });
  }, [n, navigate]);
  useEffect(() => { if (n) setInput(n); }, [n]);

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ["track", n],
    enabled: !!n,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("track_order", { _number: n! });
      if (error) throw error;
      return (data?.[0] ?? null);
    },
  });

  const cancelFn = useServerFn(notifyCancel);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const cancel = async () => {
    const { error } = await supabase.rpc("cancel_order_client", { _number: n!, _reason: reason });
    if (error) { toast.error(error.message); refetch(); return; }
    try { await cancelFn({ data: { orderNumber: n! } }); } catch (e) { console.error(e); }
    setAsking(false);
    toast.success("Commande annulée");
    refetch();
  };

  const cancelled = order?.status === "annulée";
  const idx = TRACK_STEPS.findIndex((s) => s.v === order?.status);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-black">Suivre ma commande</h1>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (input.trim()) navigate({ to: "/suivi", search: { n: input.trim().toUpperCase() } }); }}>
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ex. DMI-1042" className="h-12 rounded-full" />
          <button className="h-12 shrink-0 rounded-full bg-primary px-6 font-bold text-primary-foreground">Voir</button>
        </form>
        {saved.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="text-muted-foreground">Mes commandes :</span>
            {saved.map((s) => <button key={s} onClick={() => navigate({ to: "/suivi", search: { n: s } })} className="rounded-full bg-secondary px-3 py-1 font-bold">{s}</button>)}
          </div>
        )}

        {n && isLoading && <p className="mt-8 text-muted-foreground">Chargement…</p>}
        {n && !isLoading && !order && <p className="mt-8 text-muted-foreground">Aucune commande trouvée avec ce numéro.</p>}

        {order && (
          <div className="mt-8 rounded-[2rem] bg-card p-6 shadow-bubble">
            <p className="text-sm text-muted-foreground">Commande</p>
            <p className="text-2xl font-black">{order.order_number}</p>

            {cancelled ? (
              <div className="mt-5 rounded-2xl bg-destructive/10 p-4 text-destructive">
                <p className="font-black">Commande annulée{order.cancelled_by === "admin" ? " par notre équipe" : ""}</p>
                {order.cancel_reason && <p className="mt-1 text-sm">Motif : {order.cancel_reason}</p>}
                {order.payment_method === "mobile_money" && <p className="mt-2 text-sm font-bold">Ton remboursement sera traité par notre équipe.</p>}
              </div>
            ) : (
              <ol className="mt-6 grid grid-cols-4 gap-2">
                {TRACK_STEPS.map((s, i) => (
                  <li key={s.v} className="text-center">
                    <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full font-black ${i <= idx ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                      {i < idx || order.status === "livrée" ? <Check className="h-5 w-5" /> : i + 1}
                    </div>
                    <div className={`mt-2 h-1 rounded-full ${i <= idx ? "bg-primary" : "bg-secondary"}`} />
                    <p className={`mt-2 text-xs font-bold ${i <= idx ? "" : "text-muted-foreground"}`}>{s.l}</p>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-6 space-y-1 border-t pt-4 text-sm">
              {(order.items as unknown as Item[]).map((i, k) => (
                <div key={k}>
                  <div className="flex justify-between gap-2"><span>{i.quantity} × {i.name}{i.format && !i.name.includes(i.format) ? ` (${i.format})` : ""}</span><span className="shrink-0">{formatPrice(i.price * i.quantity)}</span></div>
                  {i.extras?.map((e, j) => <p key={j} className="pl-4 text-xs text-muted-foreground">+ {e.quantity} × {e.name} ({formatPrice(e.price)})</p>)}
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1 border-t pt-4 text-sm">
              <p className="break-words"><b>Lieu :</b> {order.delivery_location}</p>
              <p><b>Heure prévue :</b> {order.order_type === "group" ? "Commande groupée · " : ""}{(order.order_type === "preorder" || order.order_type === "group") && order.scheduled_at ? new Date(order.scheduled_at).toLocaleString("fr-FR", { timeZone: "Africa/Lome", dateStyle: "short", timeStyle: "short" }) : "Immédiate"}</p>
              <p><b>Paiement :</b> {order.payment_method === "cash" ? "Cash à la livraison" : "Mobile money (Mixx)"}</p>
              <p className="text-base font-black">Total : {formatPrice(order.total)}</p>
            </div>

            {!cancelled && order.status === "nouvelle" && (
              asking ? (
                <div className="mt-6 rounded-2xl bg-secondary p-4">
                  <p className="font-bold">Confirmer l'annulation ?</p>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Motif (facultatif)" className="mt-3 rounded-full bg-card" />
                  <div className="mt-3 flex gap-2">
                    <button onClick={cancel} className="rounded-full bg-destructive px-5 py-2 font-bold text-destructive-foreground">Oui, annuler</button>
                    <button onClick={() => setAsking(false)} className="rounded-full border px-5 py-2 font-bold">Non</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAsking(true)} className="mt-6 w-full rounded-full border-2 border-destructive py-3 font-bold text-destructive">Annuler ma commande</button>
              )
            )}
            {!cancelled && order.status !== "nouvelle" && order.status !== "livrée" && (
              <p className="mt-6 rounded-2xl bg-secondary p-4 text-sm font-semibold">Ta commande est déjà en préparation, contacte-nous au 99 84 85 22</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
