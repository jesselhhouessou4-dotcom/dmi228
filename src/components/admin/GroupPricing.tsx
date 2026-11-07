import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatPrice } from "@/lib/cart";
import { useGroupSettings } from "@/lib/group-pricing";

export function GroupPricing() {
  const qc = useQueryClient();
  const { data } = useGroupSettings();
  const { data: dishes } = useQuery({
    queryKey: ["dishes", "group-admin"],
    queryFn: async () => (await supabase.from("dishes").select("id,name,price,group_price").order("name")).data ?? [],
  });
  const [form, setForm] = useState<{ min: string; lead: string; type: string; value: string } | null>(null);
  useEffect(() => {
    if (data && !form) setForm({ min: String(data.min_items), lead: String(data.lead_hours), type: data.discount_type, value: String(data.discount_value) });
  }, [data, form]);
  if (!data || !form) return null;

  const update = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from("group_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) { toast.error(error.message); return false; }
    qc.invalidateQueries({ queryKey: ["group-settings"] });
    return true;
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const min = parseInt(form.min, 10), lead = parseInt(form.lead, 10), value = parseInt(form.value, 10);
    if (isNaN(min) || min < 2 || min > 1000) return toast.error("Seuil entre 2 et 1000 articles");
    if (isNaN(lead) || lead < 1 || lead > 720) return toast.error("Délai entre 1 et 720 heures");
    if (isNaN(value) || value < 0 || (form.type === "percent" && value > 100)) return toast.error("Valeur de remise invalide");
    if (await update({ min_items: min, lead_hours: lead, discount_type: form.type, discount_value: value })) toast.success("Tarifs groupés enregistrés");
  };
  const setDishPrice = async (id: string, raw: string) => {
    const v = raw.trim() === "" ? null : parseInt(raw, 10);
    if (v !== null && (isNaN(v) || v < 0)) return toast.error("Prix invalide");
    const { error } = await supabase.from("dishes").update({ group_price: v }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(v === null ? "Prix groupé retiré" : "Prix groupé enregistré");
    qc.invalidateQueries({ queryKey: ["dishes"] });
  };

  return (
    <div className="mt-4 max-w-xl space-y-4">
      <div className="flex items-center justify-between rounded-[2rem] bg-card p-5 shadow-bubble">
        <div><p className="font-bold">Commande groupée</p><p className="text-sm text-muted-foreground">{data.enabled ? "Activée" : "Désactivée"}</p></div>
        <Switch checked={data.enabled} onCheckedChange={(v) => update({ enabled: v })} />
      </div>
      <form onSubmit={save} className="space-y-3 rounded-[2rem] bg-card p-5 shadow-bubble">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold">Seuil minimum (articles)<Input type="number" min={2} value={form.min} onChange={(e) => setForm({ ...form, min: e.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          <label className="text-sm font-semibold">Délai minimum (heures)<Input type="number" min={1} value={form.lead} onChange={(e) => setForm({ ...form, lead: e.target.value })} className="mt-1 h-11 rounded-xl" /></label>
          <label className="text-sm font-semibold">Type de remise
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 h-11 w-full rounded-xl border bg-background px-3">
              <option value="percent">Pourcentage (%)</option>
              <option value="fixed">Montant fixe par article (FCFA)</option>
            </select>
          </label>
          <label className="text-sm font-semibold">Valeur{form.type === "percent" ? " (%)" : " (FCFA)"}<Input type="number" min={0} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="mt-1 h-11 rounded-xl" /></label>
        </div>
        <button className="h-11 w-full rounded-full bg-primary font-bold text-primary-foreground">Enregistrer</button>
      </form>
      <div className="space-y-2 rounded-[2rem] bg-card p-5 shadow-bubble">
        <p className="font-bold">Prix groupé spécifique (facultatif)</p>
        <p className="text-sm text-muted-foreground">Remplace la remise générale pour ce produit. Laisse vide pour utiliser la remise générale.</p>
        {dishes?.map((d) => (
          <div key={d.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{d.name} <span className="text-muted-foreground">({formatPrice(d.price)})</span></span>
            <Input type="number" min={0} placeholder="—" defaultValue={d.group_price ?? ""} onBlur={(e) => { if (e.target.value !== String(d.group_price ?? "")) setDishPrice(d.id, e.target.value); }} className="h-10 w-28 shrink-0 rounded-xl" aria-label={`Prix groupé ${d.name}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
