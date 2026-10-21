import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/cart";
import { DISH_COLUMNS, categoryLabel, type Dish } from "@/lib/dishes";
import logo from "@/assets/dmi-new-logo.png.asset.json";
import hero from "@/assets/hero-food.jpg";

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

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`transition-all duration-700 ${shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
      {children}
    </div>
  );
}

function Carousel({ dishes }: { dishes: Dish[] }) {
  const pics = dishes.filter((d) => d.image_url);
  const chosen = pics.filter((d) => d.in_carousel);
  const slides = (chosen.length ? chosen : pics).slice(0, 8);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 2000);
    return () => clearInterval(t);
  }, [paused, slides.length]);
  if (slides.length === 0)
    return <img src={hero} alt="Plats africains appétissants" width={1280} height={896} className="aspect-[4/3] w-full rounded-[2.5rem] object-cover shadow-bubble" />;
  return (
    <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)} onTouchEnd={() => setTimeout(() => setPaused(false), 3000)}>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2.5rem] shadow-bubble">
        {slides.map((d, k) => (
          <div key={d.id} className={`absolute inset-0 transition-opacity duration-500 ${k === i % slides.length ? "opacity-100" : "opacity-0"}`}>
            <img src={d.image_url!} alt={d.name} className="h-full w-full object-cover" />
            <span className="absolute bottom-4 left-4 rounded-full bg-background/90 px-4 py-1 text-sm font-bold text-foreground">{d.name}</span>
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {slides.map((d, k) => (
            <button key={d.id} onClick={() => setI(k)} aria-label={`Photo ${k + 1}`} className={`h-2.5 rounded-full bg-brand-foreground transition-all ${k === i % slides.length ? "w-6" : "w-2.5 opacity-50"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function Index() {
  const { data } = useDishes();
  return (
    <main className="min-h-screen bg-brand text-brand-foreground">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center px-6 pb-10 pt-8 md:flex-row md:gap-12">
        <div className="flex flex-1 animate-in fade-in slide-in-from-bottom-4 flex-col items-center text-center duration-700 md:items-start md:text-left">
          <img src={logo.url} alt="Logo Don't Mind It" width={140} height={140} className="h-32 w-32 rounded-3xl object-contain shadow-bubble md:h-36 md:w-36" />
          <h1 className="mt-8 text-5xl font-black leading-tight md:text-6xl">Don't mind it !</h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed opacity-90">
            Ne te soucie pas de ce que tu vas manger, ne te fatigue pas à chercher ni à te déplacer : on s'occupe de tout.
          </p>
          <Link to="/menu" className="mt-8 inline-flex h-14 items-center justify-center rounded-full bg-brand-foreground px-10 text-lg font-bold text-brand shadow-bubble transition-transform hover:scale-105">
            Commander
          </Link>
        </div>
        <div className="mt-10 w-full flex-1 md:mt-0"><Carousel dishes={data ?? []} /></div>
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
      <Reveal><h2 className="text-3xl font-black">Nos plats du moment</h2></Reveal>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {list.map((d, k) => (
          <Reveal key={d.id} delay={k * 100}>
            <Link to="/menu" hash={hash(d.category)} className="block overflow-hidden rounded-[2rem] bg-card text-card-foreground shadow-bubble">
              {d.image_url ? <img src={d.image_url} alt={d.name} loading="lazy" className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center bg-secondary text-secondary-foreground"><UtensilsCrossed className="h-8 w-8" /></div>}
              <div className="p-4">
                <span className="text-xs font-bold uppercase text-muted-foreground">{categoryLabel(d.category)}</span>
                <p className="font-bold">{d.name}</p>
                <p className="font-semibold text-primary">{formatPrice(d.formats?.[0]?.price ?? d.price)}</p>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
      <Reveal>
        <div className="mt-10 text-center">
          <Link to="/menu" className="inline-flex h-14 items-center rounded-full bg-brand-foreground px-10 text-lg font-bold text-brand shadow-bubble transition-transform hover:scale-105">Commander</Link>
        </div>
      </Reveal>
    </section>
  );
}
