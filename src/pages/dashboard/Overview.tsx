import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Wallet, ListChecks, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

import { StatCard } from "@/components/dashboard/StatCard";
import { getAdminOverviewStats } from "@/services/admin/adminStatsService";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

export default function DashboardOverview() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "overview-stats"],
    queryFn: getAdminOverviewStats,
    refetchInterval: 60_000,
  });

  useRealtimeInvalidate({
    channelName: "admin-overview-bookings",
    table: "bookings",
    queryKeys: [["admin", "overview-stats"]],
  });
  useRealtimeInvalidate({
    channelName: "admin-overview-receipts",
    table: "payment_receipts",
    queryKeys: [["admin", "overview-stats"]],
  });

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">نظرة عامة</h1>

      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <AlertTriangle className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">تعذر تحميل البيانات.</p>
          <button onClick={() => refetch()} className="text-sm font-medium text-primary underline underline-offset-4">
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="حجوزات اليوم" value={data?.todaysBookings ?? 0} icon={CalendarCheck} isLoading={isLoading} />
          <StatCard
            label="إيرادات اليوم"
            value={`${data?.todaysRevenue ?? 0} ج.م`}
            icon={Wallet}
            isLoading={isLoading}
            tone="success"
          />
          <StatCard label="إجمالي الحجوزات" value={data?.totalBookings ?? 0} icon={ListChecks} isLoading={isLoading} />
          <StatCard
            label="إيصالات بانتظار المراجعة"
            value={data?.pendingReceipts ?? 0}
            icon={Clock}
            isLoading={isLoading}
            tone="warning"
          />
          <StatCard
            label="حجوزات مؤكدة"
            value={data?.confirmedBookings ?? 0}
            icon={CheckCircle2}
            isLoading={isLoading}
            tone="success"
          />
          <StatCard
            label="حجوزات ملغاة"
            value={data?.cancelledBookings ?? 0}
            icon={XCircle}
            isLoading={isLoading}
            tone="destructive"
          />
        </div>
      )}
    </div>
  );
}
