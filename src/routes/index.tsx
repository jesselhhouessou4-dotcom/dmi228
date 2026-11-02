import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HomeReveal, HomeParallax } from "@/components/HomeMotion";
import { HomeCarousel } from "@/components/HomeCarousel";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/cart";
import { DISH_COLUMNS, categoryLabel, type Dish } from "@/lib/dishes";
import logo from "@/assets/dmi-new-logo.png.asset.json";
import { CustomerNav } from "@/components/CustomerNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Don't mind it ! — Commande en ligne" },
      { name: "description", content: "Ne te soucie pas de ce que tu vas manger : commande en ligne, on s'occupe de tout." },
      { property: "og:title", content: "Don't mind it ! — Commande en ligne" },
      { property: "og:description", content: "Commande ton repas, on te le livre." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function useDishes() {
  return useQuery({
    queryKey: ["dishes", "home"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dishes").select(DISH_COLUMNS).eq("published", true).order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Dish[];
    },
  });
}

function Index() {
  const { data } = useDishes();
  return (
    <main className="home-page min-h-screen overflow-x-clip bg-brand text-brand-foreground">
      <div className="mx-auto flex max-w-5xl justify-end px-6 pt-3"><CustomerNav /></div>
      <div className="home-intro mx-auto flex max-w-5xl flex-col items-center px-6 pb-10 pt-8 md:flex-row md:gap-12">
        <div className="flex min-w-0 flex-1 flex-col items-center text-center md:items-start md:text-left">
          <HomeReveal direction="up"><img src={logo.url} alt="Logo Don't Mind It" width={140} height={140} className="home-logo h-32 w-32 rounded-3xl object-contain shadow-bubble md:h-36 md:w-36" /></HomeReveal>
          <HomeReveal direction="left" className="mt-8"><h1 className="text-5xl font-black leading-tight md:text-6xl">Don't mind it <span className="home-exclamation inline-block">!</span></h1></HomeReveal>
          <HomeReveal direction="right" className="mt-5 max-w-md"><p className="home-concept text-lg leading-relaxed opacity-90">
            <span>Ne te soucie pas de ce que tu vas manger,</span>{" "}
            <span>ne te fatigue pas à chercher ni à te déplacer :</span>{" "}
            <span>on s'occupe de tout.</span>
          </p></HomeReveal>
        </div>
        <HomeReveal direction="right" className="mt-10 w-full min-w-0 flex-1 md:mt-0"><HomeParallax><HomeCarousel dishes={data ?? []} /></HomeParallax></HomeReveal>
      </div>
      <Featured dishes={data ?? []} />
    </main>
  );
}

function Featured({ dishes }: { dishes: Dish[] }) {
  const chosen = dishes.filter((d) => d.featured);
  const list = (chosen.length ? chosen : [
    ...dishes.filter((d) => d.category === "plat").slice(0, 2),
    ...dishes.filter((d) => d.category === "dessert").slice(0, 2),
  ]).slice(0, 4);
  if (list.length === 0) return null;
  const hash = (c: string) => (c === "dessert" ? "desserts" : c === "boisson" ? "boissons" : "plats");
  return (
    <section className="mx-auto max-w-5xl px-6 pb-16">
      <HomeReveal direction="left"><h2 className="text-3xl font-black">Nos plats du moment</h2></HomeReveal>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {list.map((d, k) => (
          <HomeReveal key={d.id} direction={k % 3 === 0 ? "right" : k % 3 === 1 ? "left" : "up"}>
            <Link to="/menu" hash={hash(d.category)} className="home-dish block overflow-hidden rounded-[2rem] bg-card text-card-foreground shadow-bubble">
              {d.image_url ? <img src={d.image_url} alt={d.name} loading="lazy" className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center bg-secondary text-secondary-foreground"><UtensilsCrossed className="h-8 w-8" /></div>}
              <HomeReveal direction={k % 2 ? "right" : "left"} className="p-4">
                <span className="text-xs font-bold uppercase text-muted-foreground">{categoryLabel(d.category)}</span>
                <p className="font-bold">{d.name}</p>
                <p className="font-semibold text-primary">{formatPrice(d.formats?.[0]?.price ?? d.price)}</p>
              </HomeReveal>
            </Link>
          </HomeReveal>
        ))}
      </div>
      <HomeReveal>
        <div className="mt-10 text-center">
          <Button asChild className="home-action h-14 rounded-full bg-brand-foreground px-10 text-lg font-bold text-brand shadow-bubble hover:bg-brand-foreground"><Link to="/menu">Commander</Link></Button>
        </div>
      </HomeReveal>
    </section>
  );
}
