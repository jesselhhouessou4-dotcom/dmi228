import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion admin — Don't mind it !" },
      { name: "description", content: "Espace administrateur." },
      { property: "og:title", content: "Connexion admin — Don't mind it !" },
      { property: "og:description", content: "Espace administrateur." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return toast.error("Email ou mot de passe incorrect");
      navigate({ to: "/admin" });
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/admin" } });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Compte créé ! Vérifie ta boîte mail pour confirmer.");
      setMode("in");
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <form onSubmit={submit} className="mx-auto mt-12 max-w-sm space-y-4 rounded-[2rem] bg-card p-6 shadow-bubble">
        <h1 className="text-2xl font-black">{mode === "in" ? "Connexion admin" : "Créer un compte"}</h1>
        <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" />
        <Input type="password" required minLength={6} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl" />
        <button disabled={loading} className="h-12 w-full rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-60">
          {mode === "in" ? "Se connecter" : "Créer le compte"}
        </button>
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-sm text-muted-foreground underline">
          {mode === "in" ? "Pas encore de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
        </button>
      </form>
    </div>
  );
}
