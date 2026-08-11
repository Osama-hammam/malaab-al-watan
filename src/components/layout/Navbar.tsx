import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { env } from "@/config/env";

const NAV_LINKS = [
  { to: ROUTES.home, label: "Home" },
  { to: ROUTES.booking, label: "Book a Field" },
  { to: ROUTES.dashboard, label: "Dashboard" },
] as const;

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <NavLink
          to={ROUTES.home}
          dir="rtl"
          lang="ar"
          className="font-semibold tracking-tight"
        >
          {env.appName}
        </NavLink>

        <nav className="flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === ROUTES.home}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
