import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TEAM_CHAT_ID = -1004496815218;
const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Public: called right after a customer places an order. Safe because it only
// sends a not-yet-notified, recent order to the owner's own Telegram chat.
export const notifyNewOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const tgKey = process.env["TELEGRAM_API_KEY"];
    if (!lovableKey || !tgKey) return { ok: false, error: "not_configured" };
    const headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": tgKey,
      "Content-Type": "application/json",
    };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: order } = await supabaseAdmin
      .from("orders").select("*").eq("id", data.orderId)
      .eq("telegram_notified", false).gte("created_at", since).maybeSingle();
    if (!order) return { ok: false, error: "not_found" };

    // Order alerts go only to the team group chat.
    const chatId = TEAM_CHAT_ID;

    const items = (order.items as Array<{ name: string; quantity: number; price: number; extras?: { name: string; price: number; quantity: number }[] }>) ?? [];
    const lines = items.map((i) => [`• ${i.quantity} × ${esc(i.name)}`, ...(i.extras ?? []).map((e) => `   + ${e.quantity} × ${esc(e.name)} (${e.price.toLocaleString("fr-FR")} FCFA)`)].join("\n")).join("\n");
    const text = [
      `🛎️ <b>Nouvelle commande ${esc(order.order_number ?? "")} !</b>`,
      order.order_type === "preorder" && order.scheduled_at
        ? `⏰ <b>PRÉ-COMMANDE</b> — ${new Date(order.scheduled_at).toLocaleString("fr-FR", { timeZone: "Africa/Lome", dateStyle: "short", timeStyle: "short" })}`
        : "⚡ <b>IMMÉDIATE</b>",
      `👤 ${esc(order.customer_name)}`,
      order.customer_phone ? `📞 ${esc(order.customer_phone)}` : "",
      `📍 ${esc(order.delivery_location)}`.replace(/(https:\/\/www\.google\.com\/maps\?q=[0-9.,-]+)/, '<a href="$1">📌 Ouvrir la carte</a>'),
      `💳 ${order.payment_method === "cash" ? "Espèces à la livraison" : "Mobile money"}`,
      "",
      lines,
      "",
      `<b>Total : ${order.total.toLocaleString("fr-FR")} FCFA</b>`,
      order.note ? `📝 ${esc(order.note)}` : "",
    ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");

    const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST", headers, body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) { console.error("sendMessage", res.status, await res.text()); return { ok: false, error: "telegram" }; }
    await supabaseAdmin.from("orders").update({ telegram_notified: true }).eq("id", order.id);
    return { ok: true };
  });

// Public: announces a cancellation once (cancel_notified guards repeats).
export const notifyCancel = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ orderNumber: z.string().min(3).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const tgKey = process.env["TELEGRAM_API_KEY"];
    if (!lovableKey || !tgKey) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: o } = await supabaseAdmin.from("orders").select("*")
      .eq("order_number", data.orderNumber.toUpperCase()).eq("status", "annulée")
      .eq("cancel_notified", false).maybeSingle();
    if (!o) return { ok: false };
    const text = [
      `❌ <b>Commande annulée ${esc(o.order_number ?? "")}</b>`,
      `Par : ${o.cancelled_by === "admin" ? "l'équipe" : "le client"}`,
      `👤 ${esc(o.customer_name)}`,
      `💳 ${o.payment_method === "cash" ? "Espèces à la livraison" : "Mobile money — remboursement à traiter"}`,
      `Total : ${o.total.toLocaleString("fr-FR")} FCFA`,
      o.cancel_reason ? `📝 Motif : ${esc(o.cancel_reason)}` : "",
    ].filter(Boolean).join("\n");
    const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": tgKey, "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TEAM_CHAT_ID, text, parse_mode: "HTML" }),
    });
    if (!res.ok) return { ok: false };
    await supabaseAdmin.from("orders").update({ cancel_notified: true }).eq("id", o.id);
    return { ok: true };
  });
