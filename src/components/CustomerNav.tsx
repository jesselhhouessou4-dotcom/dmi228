import { Link } from "@tanstack/react-router";
import { Bell, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomer } from "@/lib/customer";

export function CustomerNav() {
  const { user, unread } = useCustomer();
  return <div className="flex shrink-0 items-center gap-1">
    {user && <Button asChild variant="ghost" size="icon" className="relative text-brand-foreground" title="Mes notifications"><Link to="/mon-espace" search={{ tab: "notifications" }} aria-label={`Mes notifications, ${unread} non lues`}><Bell />{unread > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs text-destructive-foreground">{unread > 99 ? "99+" : unread}</span>}</Link></Button>}
    <Button asChild variant="ghost" size="icon" className="text-brand-foreground" title={user ? "Mon espace" : "Connexion client"}><Link to={user ? "/mon-espace" : "/connexion"} aria-label={user ? "Mon espace" : "Connexion client"}><UserRound /></Link></Button>
  </div>;
}