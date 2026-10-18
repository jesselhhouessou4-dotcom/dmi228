import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/dmi-logo.png.asset.json";
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

function Index() {
  return (
    <main className="min-h-screen bg-brand text-brand-foreground">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center px-6 pb-10 pt-8 md:flex-row md:gap-12">
        <div className="flex flex-1 flex-col items-center text-center md:items-start md:text-left">
          <img src={logo.url} alt="Logo Don't Mind It" width={140} height={140} className="h-32 w-32 rounded-3xl shadow-bubble md:h-36 md:w-36" />
          <h1 className="mt-8 text-5xl font-black leading-tight md:text-6xl">Don't mind it !</h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed opacity-90">
            Ne te soucie pas de ce que tu vas manger, ne te fatigue pas à chercher ni à te déplacer : on s'occupe de tout.
          </p>
          <Link
            to="/menu"
            className="mt-8 inline-flex h-14 items-center justify-center rounded-full bg-brand-foreground px-10 text-lg font-bold text-brand shadow-bubble transition-transform hover:scale-105"
          >
            Commander
          </Link>
        </div>
        <div className="mt-10 w-full flex-1 md:mt-0">
          <img src={hero} alt="Plats africains appétissants" width={1280} height={896} className="aspect-[4/3] w-full rounded-[2.5rem] object-cover shadow-bubble" />
        </div>
      </div>
    </main>
  );
}
