import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, CupSoda, Minus, Plus, ShoppingBag, UtensilsCrossed, X } from "lucide-react";
import { extrasForDish, unitPrice, type ChosenExtra, type Extra } from "@/lib/extras";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart, formatPrice } from "@/lib/cart";
import { CATEGORIES, DISH_COLUMNS, categoryLabel, type Dish } from "@/lib/dishes";
import { SiteHeader } from "@/components/SiteHeader";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu — Don't mind it !" },
      { name: "description", content: "Plats, desserts et boissons : choisis et ajoute au panier." },
      { property: "og:title", content: "Menu — Don't mind it !" },
      { property: "og:description", content: "Découvre nos plats, desserts et boissons." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MenuPage,
});

function useAddDish() {
  const { add } = useCart();
  return (dish: Dish, qty: number, formatName?: string | null, extras: ChosenExtra[] = []) => {
    const f = dish.formats?.find((x) => x.name === formatName);
    add({
      dish_id: dish.id, name: f ? `${dish.name} (${f.name})` : dish.name, price: f ? f.price : dish.price,
      image_url: dish.image_url, format: f?.name ?? null, category: dish.category, extras,
    }, qty);
    toast.success(`${qty} × ${dish.name}${f ? ` (${f.name})` : ""} ajouté au panier`);
  };
}

function useExtras() {
  return useQuery({
    queryKey: ["extras", "public"],
    queryFn: async () => {
      const { data, error } = await supabase.from("extras").select("id,name,price,is_available,categories,dish_ids").eq("is_available", true).order("name");
      if (error) throw error;
      return data as Extra[];
    },
  });
}

function ExtrasPicker({ list, chosen, setChosen }: { list: Extra[]; chosen: Record<string, number>; setChosen: (c: Record<string, number>) => void }) {
  if (!list.length) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-bold">Suppléments</p>
      <div className="space-y-2">
        {list.map((e) => {
          const q = chosen[e.id] ?? 0;
          return (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-3 py-2">
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{e.name}</p><p className="text-xs text-muted-foreground">+ {formatPrice(e.price)}</p></div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" disabled={!q} onClick={() => setChosen({ ...chosen, [e.id]: q - 1 })} className="grid h-8 w-8 place-items-center rounded-full bg-card disabled:opacity-40" aria-label={`Retirer ${e.name}`}><Minus className="h-4 w-4" /></button>
                <span className="w-6 text-center font-bold">{q}</span>
                <button type="button" onClick={() => setChosen({ ...chosen, [e.id]: Math.min(10, q + 1) })} className="grid h-8 w-8 place-items-center rounded-full bg-card" aria-label={`Ajouter ${e.name}`}><Plus className="h-4 w-4" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Img({ dish, className }: { dish: Dish; className: string }) {
  return dish.image_url ? (
    <img src={dish.image_url} alt={dish.name} loading="lazy" className={`${className} object-cover`} />
  ) : (
    <div className={`${className} flex items-center justify-center bg-secondary text-secondary-foreground`}>
      {dish.category === "boisson" ? <CupSoda className="h-10 w-10" /> : <UtensilsCrossed className="h-10 w-10" />}
    </div>
  );
}

function Qty({ qty, setQty }: { qty: number; setQty: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
      <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-8 w-8 place-items-center rounded-full bg-card" aria-label="Moins"><Minus className="h-4 w-4" /></button>
      <span className="w-6 text-center font-bold">{qty}</span>
      <button type="button" onClick={() => setQty(Math.min(99, qty + 1))} className="grid h-8 w-8 place-items-center rounded-full bg-card" aria-label="Plus"><Plus className="h-4 w-4" /></button>
    </div>
  );
}

function FormatPicker({ dish, value, onChange }: { dish: Dish; value: string | null; onChange: (v: string) => void }) {
  if (!dish.formats?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {dish.formats.map((f) => (
        <button key={f.name} type="button" onClick={() => onChange(f.name)}
          className={`rounded-full border-2 px-3 py-1 text-xs font-bold ${value === f.name ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
          {f.name} · {formatPrice(f.price)}
        </button>
      ))}
    </div>
  );
}

function DishCard({ dish, onOpen }: { dish: Dish; onOpen: () => void }) {
  const addDish = useAddDish();
  const [qty, setQty] = useState(1);
  const [fmt, setFmt] = useState<string | null>(dish.formats?.[0]?.name ?? null);
  const [showIng, setShowIng] = useState(false);
  const out = !dish.is_available;
  const price = dish.formats?.find((f) => f.name === fmt)?.price ?? dish.price;
  return (
    <div className={`overflow-hidden flex flex-col rounded-2xl sm:rounded-[2rem] bg-card shadow-bubble ${out ? "opacity-60 grayscale" : ""}`}>
      <button onClick={onOpen} className="relative block w-full text-left" aria-label={`Voir ${dish.name}`}>
        <Img dish={dish} className="aspect-square w-full sm:aspect-[4/3]" />
        {out && <span className="absolute left-2 top-2 rounded-full bg-destructive px-2 sm:px-3 py-1 text-xs font-bold text-destructive-foreground">Épuisé</span>}
        <div className="px-3 pt-2 sm:px-5 sm:pt-4">
          <h3 className="line-clamp-2 text-sm font-bold leading-tight sm:text-lg">{dish.name}</h3>
          <p className="mt-1 text-sm font-semibold text-primary sm:text-base">{formatPrice(price)}</p>
        </div>
      </button>
      <div className="hidden space-y-3 px-5 pt-2 sm:block">
        {dish.ingredients && (
          <div>
            <button type="button" onClick={() => setShowIng((s) => !s)} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
              Ingrédients <ChevronDown className={`h-3 w-3 transition ${showIng ? "rotate-180" : ""}`} />
            </button>
            {showIng && <p className="mt-2 text-sm text-muted-foreground">{dish.ingredients}</p>}
          </div>
        )}
        {!out && <FormatPicker dish={dish} value={fmt} onChange={setFmt} />}
      </div>
      <div className="mt-auto p-3 pt-2 sm:hidden">
        {out ? <p className="text-xs font-semibold text-muted-foreground">Indisponible</p> : (
          <button onClick={() => { if ((dish.formats?.length ?? 0) > 1) onOpen(); else addDish(dish, 1, fmt); }} className="flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground active:scale-95"><Plus className="h-3.5 w-3.5" /> Ajouter</button>
        )}
      </div>
      <div className="mt-auto hidden items-center justify-between gap-2 p-5 pt-3 sm:flex">
        {out ? <p className="text-sm font-semibold text-muted-foreground">Indisponible pour le moment</p> : (
          <>
            <Qty qty={qty} setQty={setQty} />
            <button onClick={() => { addDish(dish, qty, fmt); setQty(1); }} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Ajouter</button>
          </>
        )}
      </div>
    </div>
  );
}

function DrinkSuggest({ drinks }: { drinks: Dish[] }) {
  const cart = useCart();
  const addDish = useAddDish();
  const list = drinks.filter((d) => d.is_available);
  if (cart.hasDrink || list.length === 0) return null;
  return (
    <div className="rounded-2xl border-2 border-dashed border-primary/40 p-3">
      <p className="mb-2 flex items-center gap-2 font-bold"><CupSoda className="h-4 w-4" /> Ajouter une boisson ?</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {list.map((d) => {
          const f = d.formats?.[0];
          return (
            <button key={d.id} type="button" onClick={() => addDish(d, 1, f?.name ?? null)} className="shrink-0 rounded-full bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground">
              + {d.name}{f ? ` ${f.name}` : ""} · {formatPrice(f?.price ?? d.price)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DishDetail({ dish, drinks, onClose }: { dish: Dish | null; drinks: Dish[]; onClose: () => void }) {
  const addDish = useAddDish();
  const [qty, setQty] = useState(1);
  const [fmt, setFmt] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const { data: allExtras = [] } = useExtras();
  if (!dish) return null;
  const current = fmt ?? dish.formats?.[0]?.name ?? null;
  const available = extrasForDish(allExtras, dish);
  const picked: ChosenExtra[] = available.filter((e) => (chosen[e.id] ?? 0) > 0).map((e) => ({ id: e.id, name: e.name, price: e.price, quantity: chosen[e.id] ?? 0 }));
  const price = unitPrice(dish.formats?.find((f) => f.name === current)?.price ?? dish.price, picked);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) { onClose(); setQty(1); setFmt(null); setChosen({}); } }}>
      <DialogContent className="bottom-0 left-0 top-auto max-h-[92vh] w-full max-w-full translate-x-0 translate-y-0 overflow-y-auto rounded-b-none rounded-t-3xl p-0 data-[state=open]:slide-in-from-bottom sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-3xl">
        <Img dish={dish} className="aspect-[16/10] w-full sm:aspect-[4/3]" />
        <div className="min-w-0 space-y-4 p-4 sm:p-5">
          <div>
            <span className="text-xs font-bold uppercase text-muted-foreground">{categoryLabel(dish.category)}</span>
            <DialogTitle className="font-display text-2xl">{dish.name}</DialogTitle>
            <p className="mt-1 text-lg font-bold text-primary">{formatPrice(price)}</p>
          </div>
          {dish.ingredients && (
            <div><p className="text-sm font-bold">Composition</p><p className="text-sm text-muted-foreground">{dish.ingredients}</p></div>
          )}
          {dish.is_available ? (
            <>
              <FormatPicker dish={dish} value={current} onChange={setFmt} />
              <ExtrasPicker list={available} chosen={chosen} setChosen={setChosen} />
              <div className="flex items-center justify-between gap-2">
                <Qty qty={qty} setQty={setQty} />
                <button onClick={() => { addDish(dish, qty, current, picked); setQty(1); setChosen({}); }} className="rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground sm:px-5 sm:text-base">
                  Ajouter · {formatPrice(price * qty)}
                </button>
              </div>
              {dish.category !== "boisson" && <DrinkSuggest drinks={drinks} />}
            </>
          ) : <p className="rounded-xl bg-secondary p-3 text-center font-bold">Épuisé</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MenuPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Dish | null>(null);
  const { data: dishes, isLoading } = useQuery({
    queryKey: ["dishes", "published"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dishes").select(DISH_COLUMNS).eq("published", true).order("created_at");
      if (error) throw error;
      return data as unknown as Dish[];
    },
  });
  const drinks = dishes?.filter((d) => d.category === "boisson") ?? [];

  const cartButton = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="relative flex shrink-0 items-center gap-2 rounded-full bg-brand-foreground px-4 py-2 font-bold text-brand">
          <ShoppingBag className="h-5 w-5" />
          <span>{formatPrice(cart.total)}</span>
          {cart.count > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-xs text-destructive-foreground">{cart.count}</span>}
        </button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader><SheetTitle className="font-display text-2xl">Ton panier</SheetTitle></SheetHeader>
        <div className="flex-1 space-y-3 overflow-y-auto px-4">
          {cart.items.length === 0 && <p className="text-muted-foreground">Ton panier est vide.</p>}
          {cart.items.map((i) => (
            <div key={i.key} className="flex items-center gap-3 rounded-2xl bg-secondary p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{i.name}</p>
                {i.extras?.map((e) => (
                  <div key={e.id} className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="min-w-0 flex-1 truncate">+ {e.quantity} × {e.name} ({formatPrice(e.price)})</span>
                    <button onClick={() => cart.setExtraQty(i.key, e.id, e.quantity - 1)} className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-card" aria-label={`Moins de ${e.name}`}><Minus className="h-3 w-3" /></button>
                    <button onClick={() => cart.setExtraQty(i.key, e.id, e.quantity + 1)} className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-card" aria-label={`Plus de ${e.name}`}><Plus className="h-3 w-3" /></button>
                    <button onClick={() => cart.setExtraQty(i.key, e.id, 0)} className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-card" aria-label={`Retirer ${e.name}`}><X className="h-3 w-3" /></button>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground">{i.quantity > 1 ? `${i.quantity} × ${formatPrice(i.price)} = ` : ""}{formatPrice(i.price * i.quantity)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => cart.setQty(i.key, i.quantity - 1)} className="grid h-8 w-8 place-items-center rounded-full bg-card" aria-label="Moins"><Minus className="h-4 w-4" /></button>
                <span className="w-6 text-center font-bold">{i.quantity}</span>
                <button onClick={() => cart.setQty(i.key, i.quantity + 1)} className="grid h-8 w-8 place-items-center rounded-full bg-card" aria-label="Plus"><Plus className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {cart.items.length > 0 && <DrinkSuggest drinks={drinks} />}
          {cart.items.length > 0 && (
            <div className="pt-2">
              <label className="mb-2 block font-semibold">Personnaliser ma commande</label>
              <Textarea value={cart.note} maxLength={500} onChange={(e) => cart.setNote(e.target.value)} placeholder="Ex : sans piment, bien cuit…" className="rounded-2xl" />
            </div>
          )}
        </div>
        <div className="border-t p-4">
          <div className="mb-3 flex justify-between text-lg font-bold"><span>Total</span><span>{formatPrice(cart.total)}</span></div>
          <button disabled={cart.items.length === 0} onClick={() => setConfirm(true)} className="h-12 w-full rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-50">
            Valider ma commande
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="min-h-screen pb-24">
      <SiteHeader right={cartButton} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-black">Le menu</h1>
        <p className="mt-1 text-muted-foreground">Touche un article pour voir sa fiche.</p>
        {isLoading && <p className="mt-8 text-muted-foreground">Chargement…</p>}
        <nav className="sticky top-16 z-10 mt-5 flex gap-2 overflow-x-auto bg-background py-2 shadow-[0_8px_12px_-10px_rgba(0,0,0,0.25)]">
          {CATEGORIES.map((c) => (
            <a key={c.id} href={`#${c.id}`} className="shrink-0 rounded-full bg-secondary px-5 py-2 font-bold text-secondary-foreground hover:bg-primary hover:text-primary-foreground">{c.label}</a>
          ))}
        </nav>
        {CATEGORIES.map((c) => {
          const list = dishes?.filter((d) => d.category === c.cat) ?? [];
          return (
            <section key={c.id} id={c.id} className="scroll-mt-32 pt-6">
              <h2 className="text-2xl font-black">{c.label}</h2>
              {dishes && list.length === 0 && <p className="mt-3 text-muted-foreground">Rien pour le moment.</p>}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
                {list.map((d) => <DishCard key={d.id} dish={d} onOpen={() => setDetail(d)} />)}
              </div>
            </section>
          );
        })}
      </main>
      <DishDetail dish={detail} drinks={drinks} onClose={() => setDetail(null)} />
      {cart.count > 0 && !open && (
        <button onClick={() => setOpen(true)} className="fixed inset-x-4 bottom-4 z-20 mx-auto flex h-14 max-w-md items-center justify-between rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-bubble">
          <span>Voir le panier ({cart.count})</span><span>{formatPrice(cart.total)}</span>
        </button>
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader><AlertDialogTitle>Êtes-vous sûr de vouloir valider votre commande ?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Non</AlertDialogCancel>
            <AlertDialogAction className="rounded-full" onClick={() => { setOpen(false); navigate({ to: "/commande" }); }}>Oui</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
