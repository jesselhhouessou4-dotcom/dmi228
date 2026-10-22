import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/confirmation")({
  validateSearch: z.object({ p: z.enum(["mobile_money", "cash"]).optional(), n: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Commande envoyée ! — Don't mind it !" },
      { name: "description", content: "Ta commande a bien été envoyée." },
      { property: "og:title", content: "Commande envoyée ! — Don't mind it !" },
      { property: "og:description", content: "Merci pour ta commande." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Confirmation,
});

function Confirmation() {
  const { p, n } = Route.useSearch();
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand px-6 text-center text-brand-foreground">
      <div>
        <CheckCircle2 className="mx-auto h-20 w-20" />
        <h1 className="mt-6 text-4xl font-black">Commande envoyée !</h1>
        {n && <p className="mt-4 text-lg">Ton numéro de commande : <span className="font-black">{n}</span></p>}
        <p className="mt-3 opacity-90">
          {p === "mobile_money" ? "N'oublie pas d'envoyer la capture du paiement au 99 84 85 22." : p === "cash" ? "Vous paierez à la livraison." : "On s'occupe de tout."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {n && <Link to="/suivi" search={{ n }} className="inline-flex h-12 items-center rounded-full bg-brand-foreground px-8 font-bold text-brand">Suivre ma commande</Link>}
          <Link to="/" className="inline-flex h-12 items-center rounded-full border border-brand-foreground px-8 font-bold">Retour à l'accueil</Link>
        </div>
      </div>
    </main>
  );
}
