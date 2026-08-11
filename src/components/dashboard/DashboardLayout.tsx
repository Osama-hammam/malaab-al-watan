import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarRange,
  ListChecks,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/constants/routes";
import { env } from "@/config/env";

const NAV_ITEMS = [
  { to: ROUTES.dashboard, label: "الرئيسية", icon: LayoutDashboard, end: true },
  { to: ROUTES.dashboardBookings, label: "الحجوزات", icon: ListChecks, end: false },
  { to: ROUTES.dashboardSchedule, label: "الجدول", icon: CalendarRange, end: false },
  { to: ROUTES.dashboardRevenue, label: "الإيرادات", icon: BarChart3, end: false },
  { to: ROUTES.dashboardSettings, label: "الإعدادات", icon: Settings, end: false },
] as const;

export function DashboardLayout() {
  const { user, signOut } = useAuth();

  return (
    <div dir="rtl" lang="ar" className="flex min-h-screen bg-muted/20">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-l bg-background lg:flex">
        <div className="border-b px-5 py-4">
          <p className="font-semibold">{env.appName}</p>
          <p className="text-xs text-muted-foreground">لوحة تحكم الإدارة</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
            >
              <item.icon className="size-4.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t p-3">
          <p className="truncate px-2 text-xs text-muted-foreground" dir="ltr">
            {user?.email}
          </p>
          <button
            onClick={() => void signOut()}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
          >
            <LogOut className="size-4.5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b bg-background px-4 py-3 lg:hidden">
          <p className="font-semibold">{env.appName}</p>
          <button
            onClick={() => void signOut()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <LogOut className="size-4" />
            خروج
          </button>
        </header>

        <main className="flex-1 pb-20 lg:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background lg:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Toaster position="top-center" richColors dir="rtl" />
    </div>
  );
}
