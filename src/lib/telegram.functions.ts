import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

    // Resolve the owner's chat id (saved once, discovered from the bot's messages).
    let chatId: number | null = null;
    const { data: s } = await supabaseAdmin.from("telegram_settings").select("chat_id").eq("id", 1).maybeSingle();
    if (s) chatId = Number(s.chat_id);
    if (!chatId) {
      const r = await fetch(`${GATEWAY_URL}/getUpdates`, { method: "POST", headers, body: "{}" });
      if (!r.ok) { console.error("getUpdates", r.status, await r.text()); return { ok: false, error: "telegram" }; }
      const j = await r.json() as { result?: Array<{ message?: { chat?: { id: number; type: string } } }> };
      const found = [...(j.result ?? [])].reverse().find((u) => u.message?.chat?.type === "private");
      if (!found?.message?.chat) return { ok: false, error: "no_chat" };
      chatId = found.message.chat.id;
      await supabaseAdmin.from("telegram_settings").upsert({ id: 1, chat_id: chatId });
    }

    const items = (order.items as Array<{ name: string; quantity: number; price: number }>) ?? [];
    const lines = items.map((i) => `• ${i.quantity} × ${esc(i.name)}`).join("\n");
    const text = [
      "🛎️ <b>Nouvelle commande !</b>",
      `👤 ${esc(order.customer_name)}`,
      order.customer_phone ? `📞 ${esc(order.customer_phone)}` : "",
      `📍 ${esc(order.delivery_location)}`,
      `🕐 ${esc(order.delivery_time)}`,
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
