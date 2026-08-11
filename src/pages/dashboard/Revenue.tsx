import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { BranchFilter } from "@/components/dashboard/BranchFilter";
import { getAdminRevenueReport } from "@/services/admin/adminStatsService";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoKey(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatHour(hour: number): string {
  const period = hour < 12 || hour === 24 ? "ص" : "م";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
}

export default function DashboardRevenue() {
  const [fromDate, setFromDate] = useState(daysAgoKey(7));
  const [toDate, setToDate] = useState(todayKey());
  const [branchId, setBranchId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "revenue", fromDate, toDate, branchId],
    queryFn: () => getAdminRevenueReport({ fromDate, toDate, branchId }),
  });

  const maxHourCount = Math.max(1, ...(data?.popularHours.map((h) => h.bookingsCount) ?? [1]));

  return (
    <div dir="rtl" lang="ar" className="p-4 sm:p-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">الإيرادات</h1>

      <div className="mb-6 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fromDate">من تاريخ</Label>
            <Input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="toDate">إلى تاريخ</Label>
            <Input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
        <BranchFilter value={branchId} onChange={setBranchId} />
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <AlertTriangle className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">تعذر تحميل بيانات الإيرادات.</p>
          <button onClick={() => refetch()} className="text-sm font-medium text-primary underline underline-offset-4">
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="py-2">
                <p className="text-xs text-muted-foreground">إجمالي الإيرادات</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-7 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-primary">{data?.totalRevenue ?? 0} ج.م</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-2">
                <p className="text-xs text-muted-foreground">عدد الحجوزات</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-7 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{data?.totalBookings ?? 0}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold">الإيرادات حسب الفرع</h2>
            {isLoading ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : !data || data.byBranch.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد بيانات لهذه الفترة.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.byBranch.map((b) => (
                  <div
                    key={b.branchId}
                    className="flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm"
                  >
                    <span>{b.branchName}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{b.bookingsCount} حجز</span>
                      <span className="font-semibold text-primary">{b.revenue} ج.م</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold">الإيرادات حسب نوع الملعب</h2>
            {isLoading ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : !data || data.byFieldType.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد بيانات لهذه الفترة.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.byFieldType.map((f) => (
                  <div
                    key={f.fieldType}
                    className="flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm"
                  >
                    <span dir="ltr">{f.fieldType}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{f.bookingsCount} حجز</span>
                      <span className="font-semibold text-primary">{f.revenue} ج.م</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <TrendingUp className="size-4" /> أكثر الساعات حجزًا
            </h2>
            {isLoading ? (
              <Skeleton className="h-32 w-full rounded-lg" />
            ) : !data || data.popularHours.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد بيانات لهذه الفترة.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.popularHours.map((h) => (
                  <div key={h.hour} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-xs text-muted-foreground" dir="ltr">
                      {formatHour(h.hour)}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full rounded bg-primary"
                        style={{ width: `${(h.bookingsCount / maxHourCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-medium">{h.bookingsCount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
