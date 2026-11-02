import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useCustomer } from "@/lib/customer";
import { SiteHeader } from "@/components/SiteHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/connexion")({
  head: () => ({ meta: [
    { title: "Connexion client — Don't mind it !" }, { name: "description", content: "Connecte-toi pour retrouver tes commandes et notifications DMI." },
    { property: "og:title", content: "Connexion client — Don't mind it !" }, { property: "og:description", content: "Ton compte client DMI." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: CustomerLogin,
});

function CustomerLogin() {
  const navigate = useNavigate(); const qc = useQueryClient(); const { user } = useCustomer();
  const [signup, setSignup] = useState(false); const [name, setName] = useState("");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [confirmEmail, setConfirmEmail] = useState(false);
  useEffect(() => { if (user) navigate({ to: "/mon-espace" }); }, [user, navigate]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() }, emailRedirectTo: window.location.origin + "/connexion" } });
        if (error) throw error;
        if (!data.session) { setConfirmEmail(true); return; }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["customer-session"] });
      navigate({ to: "/mon-espace" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Connexion impossible";
      toast.error(msg.includes("Email not confirmed") ? "Confirme ton adresse avec le lien reçu par e-mail." : msg.includes("Invalid login") ? "E-mail ou mot de passe incorrect." : msg);
    } finally { setBusy(false); }
  }
  async function google() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/connexion" });
      if (result.error) { toast.error(result.error.message); return; }
      if (result.redirected) return;
      await qc.invalidateQueries({ queryKey: ["customer-session"] }); navigate({ to: "/mon-espace" });
    } catch { toast.error("Connexion Google impossible. Réessaie."); } finally { setBusy(false); }
  }
  return <div className="min-h-screen"><SiteHeader /><main className="mx-auto max-w-md px-5 py-10">
    <h1 className="text-3xl font-black">{signup ? "Créer mon compte" : "Connexion client"}</h1>
    {confirmEmail ? <div className="mt-6 space-y-4"><h2 className="text-xl font-bold">Vérifie tes e-mails</h2><p>Un lien de confirmation a été envoyé. Clique dessus pour activer ton compte.</p><Button onClick={() => { setConfirmEmail(false); setSignup(false); }}>Retour à la connexion</Button></div> : <>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {signup && <label className="block text-sm font-bold">Nom<Input required maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className="mt-1 h-12" /></label>}
        <label className="block text-sm font-bold">Adresse e-mail<Input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 h-12" /></label>
        <label className="block text-sm font-bold">Mot de passe<Input required type="password" minLength={6} autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 h-12" /></label>
        <Button disabled={busy} className="h-12 w-full">{busy ? "Patiente…" : signup ? "Créer mon compte" : "Me connecter"}</Button>
      </form>
      <div className="my-5 text-center text-sm text-muted-foreground">ou</div>
      <Button variant="outline" disabled={busy} onClick={google} className="h-12 w-full">Continuer avec Google</Button>
      <Button variant="link" onClick={() => setSignup(!signup)} className="mt-4 h-auto w-full whitespace-normal">{signup ? "J’ai déjà un compte" : "Créer un compte"}</Button>
    </>}
    <Button asChild variant="link" className="mt-4 w-full"><Link to="/commande">Continuer sans compte</Link></Button>
    <Button asChild variant="link" className="mt-2 w-full"><Link to="/auth">Accès administrateur</Link></Button>
  </main></div>;
}