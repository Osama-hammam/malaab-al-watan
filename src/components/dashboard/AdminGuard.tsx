import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/constants/routes";

export function AdminGuard() {
  const { session, isAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session || !isAdmin) {
    return <Navigate to={ROUTES.dashboardLogin} replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
