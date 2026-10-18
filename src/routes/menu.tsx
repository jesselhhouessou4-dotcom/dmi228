import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Minus, Plus, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart, formatPrice } from "@/lib/cart";
import { SiteHeader } from "@/components/SiteHeader";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu — Don't mind it !" },
      { name: "description", content: "Choisis tes plats et ajoute-les au panier." },
      { property: "og:title", content: "Menu — Don't mind it !" },
      { property: "og:description", content: "Découvre nos plats du jour." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MenuPage,
});

type Dish = { id: string; name: string; price: number; image_url: string | null };

function DishCard({ dish }: { dish: Dish }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const addToCart = () => {
    add({ dish_id: dish.id, name: dish.name, price: dish.price, image_url: dish.image_url }, qty);
    toast.success(`${qty} × ${dish.name} ajouté au panier`);
    setQty(1);
  };
  return (
    <div className="overflow-hidden rounded-[2rem] bg-card shadow-bubble">
      <button onClick={addToCart} className="block w-full text-left" aria-label={`Ajouter ${dish.name}`}>
        {dish.image_url ? (
          <img src={dish.image_url} alt={dish.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-secondary text-secondary-foreground">
            <UtensilsCrossed className="h-10 w-10" />
          </div>
        )}
        <div className="px-5 pt-4">
          <h3 className="text-lg font-bold">{dish.name}</h3>
          <p className="mt-1 font-semibold text-primary">{formatPrice(dish.price)}</p>
        </div>
      </button>
      <div className="flex items-center justify-between gap-2 p-5 pt-3">
        <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-8 w-8 place-items-center rounded-full bg-card" aria-label="Moins"><Minus className="h-4 w-4" /></button>
          <span className="w-6 text-center font-bold">{qty}</span>
          <button onClick={() => setQty((q) => Math.min(99, q + 1))} className="grid h-8 w-8 place-items-center rounded-full bg-card" aria-label="Plus"><Plus className="h-4 w-4" /></button>
        </div>
        <button onClick={addToCart} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Ajouter</button>
      </div>
    </div>
  );
}

function MenuPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [open, setOpen] = useState(false);
  const { data: dishes, isLoading } = useQuery({
    queryKey: ["dishes", "published"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dishes").select("id,name,price,image_url").eq("published", true).order("created_at");
      if (error) throw error;
      return data as Dish[];
    },
  });

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
            <div key={i.dish_id} className="flex items-center gap-3 rounded-2xl bg-secondary p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{i.name}</p>
                <p className="text-sm text-muted-foreground">{formatPrice(i.price * i.quantity)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => cart.setQty(i.dish_id, i.quantity - 1)} className="grid h-8 w-8 place-items-center rounded-full bg-card" aria-label="Moins"><Minus className="h-4 w-4" /></button>
                <span className="w-6 text-center font-bold">{i.quantity}</span>
                <button onClick={() => cart.setQty(i.dish_id, i.quantity + 1)} className="grid h-8 w-8 place-items-center rounded-full bg-card" aria-label="Plus"><Plus className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
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
        <p className="mt-1 text-muted-foreground">Touche un plat pour l'ajouter au panier.</p>
        {isLoading && <p className="mt-8 text-muted-foreground">Chargement…</p>}
        {dishes && dishes.length === 0 && <p className="mt-8 text-muted-foreground">Aucun plat disponible pour le moment.</p>}
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {dishes?.map((d) => <DishCard key={d.id} dish={d} />)}
        </div>
      </main>
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
