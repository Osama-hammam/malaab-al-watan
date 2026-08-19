import { NavLink, Link } from "react-router-dom";
import { CalendarCheck, LayoutDashboard } from "lucide-react";

import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { env } from "@/config/env";

const NAV_LINKS = [
  { to: ROUTES.home, label: "الرئيسية" },
  { to: ROUTES.booking, label: "احجز الآن" },
] as const;

export function Navbar() {
  return (
    <header
      dir="rtl"
      lang="ar"
      className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <NavLink
          to={ROUTES.home}
          className="flex items-center gap-2.5 font-black text-xl tracking-tight text-foreground hover:text-primary transition-colors"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <span className="text-sm font-black">⚽</span>
          </div>
          <span>{env.appName}</span>
        </NavLink>

        {/* Nav + CTA + Admin */}
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === ROUTES.home}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                )
              }
            >
              {link.label}
            </NavLink>
          ))}

          <Link
            to={ROUTES.booking}
            className="mr-2 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-95"
          >
            <CalendarCheck className="size-4" />
            احجز الآن
          </Link>

          {/* Admin button — small, subtle */}
          <Link
            to={ROUTES.dashboardLogin}
            title="لوحة التحكم"
            className="mr-1 flex size-8 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary active:scale-95"
          >
            <LayoutDashboard className="size-4" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
