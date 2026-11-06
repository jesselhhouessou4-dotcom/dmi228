import { Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useCart, formatPrice } from "@/lib/cart";
import { useCartGroup } from "@/lib/group-pricing";

export function GroupOrderPanel() {
  const cart = useCart();
  const { settings, summary } = useCartGroup();
  if (!settings?.enabled || !summary) return null;
  const label = settings.discount_type === "percent" ? `-${settings.discount_value} %` : `-${formatPrice(settings.discount_value)} par article`;
  return (
    <div className="rounded-2xl border-2 border-primary/40 bg-card p-3">
      <label className="flex items-center gap-3 font-bold">
        <Users className="h-5 w-5 shrink-0 text-primary" />
        <span className="flex-1">Commande groupée <span className="text-xs font-semibold text-muted-foreground">({label})</span></span>
        <Switch checked={cart.group} onCheckedChange={cart.setGroup} aria-label="Commande groupée" />
      </label>
      {cart.group && (
        <div className="mt-2 space-y-1 text-sm">
          <p className="text-xs text-muted-foreground">Dès {settings.min_items} articles, à commander au moins {settings.lead_hours} h à l'avance. Un seul paiement pour toute la commande.</p>
          {summary.unlocked ? (
            <p className="font-bold text-primary">Tarif groupé appliqué : tu économises {formatPrice(summary.saved)} 🎉</p>
          ) : (
            <p className="font-bold">Encore {summary.missing} article{summary.missing > 1 ? "s" : ""} pour débloquer le tarif groupé</p>
          )}
        </div>
      )}
    </div>
  );
}

export function GroupTotal({ className = "" }: { className?: string }) {
  const { applied, summary } = useCartGroup();
  const cart = useCart();
  if (!applied || !summary) return <span className={className}>{formatPrice(cart.total)}</span>;
  return (
    <span className={`inline-flex flex-wrap items-baseline justify-end gap-x-2 ${className}`}>
      <s className="text-sm font-semibold opacity-70">{formatPrice(summary.original)}</s>
      <span>{formatPrice(summary.total)}</span>
    </span>
  );
}
