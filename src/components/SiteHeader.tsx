import { Link } from "@tanstack/react-router";
import logo from "@/assets/dmi-new-logo.png.asset.json";
import type { ReactNode } from "react";
import { CustomerNav } from "@/components/CustomerNav";

export function SiteHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 bg-brand text-brand-foreground">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img src={logo.url} alt="Logo" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl" />
          <span className="hidden truncate font-display text-lg font-black sm:inline">Don't mind it !</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {right}
          <CustomerNav />
        </div>
      </div>
    </header>
  );
}
