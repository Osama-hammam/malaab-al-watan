import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminGuard } from "@/components/dashboard/AdminGuard";
import { ROUTES } from "@/constants/routes";
import Home from "@/pages/Home";
import Booking from "@/pages/Booking";
import NotFound from "@/pages/NotFound";
import DashboardLogin from "@/pages/dashboard/DashboardLogin";
import DashboardOverview from "@/pages/dashboard/Overview";
import DashboardBookings from "@/pages/dashboard/Bookings";
import DashboardSchedule from "@/pages/dashboard/Schedule";
import DashboardRevenue from "@/pages/dashboard/Revenue";
import DashboardSettings from "@/pages/dashboard/Settings";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: ROUTES.home, element: <Home /> },
      { path: ROUTES.booking, element: <Booking /> },
      { path: "*", element: <NotFound /> },
    ],
  },
  { path: ROUTES.dashboardLogin, element: <DashboardLogin /> },
  {
    element: <AdminGuard />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: ROUTES.dashboard, element: <DashboardOverview /> },
          { path: ROUTES.dashboardBookings, element: <DashboardBookings /> },
          { path: ROUTES.dashboardSchedule, element: <DashboardSchedule /> },
          { path: ROUTES.dashboardRevenue, element: <DashboardRevenue /> },
          { path: ROUTES.dashboardSettings, element: <DashboardSettings /> },
        ],
      },
    ],
  },
]);
