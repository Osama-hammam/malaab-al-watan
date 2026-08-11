import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Plus } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DateStrip } from "@/components/booking/DateStrip";
import { CreateClosureModal } from "@/components/dashboard/CreateClosureModal";
import { ClosuresList } from "@/components/dashboard/ClosuresList";
import { getActiveBranches } from "@/services/branchesService";
import { getAdminSchedule, type AdminSlotStatus } from "@/services/admin/adminScheduleService";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<AdminSlotStatus, string> = {
  available: "border-success/40 bg-success/10",
  locked: "border-warning/40 bg-warning/10",
  booked: "border-destructive/30 bg-destructive/10",
  closed: "border-muted-foreground/30 bg-muted",
};

const STATUS_DOT: Record<AdminSlotStatus, string> = {
  available: "bg-success",
  locked: "bg-warning",
  booked: "bg-destructive",
  closed: "bg-muted-foreground",
};

const STATUS_LABEL: Record<AdminSlotStatus, string> = {
  available: "متاح",
  locked: "محجوز مؤقتًا",
  booked: "محجوز",
  closed: "مغلق",
};

const CODE_LABEL: Record<string, string> = { A: "ملعب A", B: "ملعب B", AB: "الملعب كامل (A+B)" };

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" });
}

export default function DashboardSchedule() {
  const [branchId, setBranchId] = useState<string | null>(null);
  const [date, setDate] = useState(todayKey);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: getActiveBranches });

  useEffect(() => {
    if (!branchId && branchesQuery.data && branchesQuery.data.length > 0) {
      setBranchId(branchesQuery.data[0].id);
    }
  }, [branchId, branchesQuery.data]);

  const scheduleQuery = useQuery({
    queryKey: ["admin", "schedule", branchId, date],
    queryFn: () => getAdminSchedule({ branchId: branchId as string, date }),
    enabled: Boolean(branchId),
  });

  const scheduleQueryKey = ["admin", "schedule", branchId, date];
  useRealtimeInvalidate({
    channelName: `admin-schedule-bookings-${branchId}`,
    table: "bookings",
    filter: branchId ? `branch_id=eq.${branchId}` : undefined,
    queryKeys: [scheduleQueryKey, ["admin", "closures"]],
    enabled: Boolean(branchId),
  });
  useRealtimeInvalidate({
    channelName: `admin-schedule-locks-${branchId}`,
    table: "booking_locks",
    filter: branchId ? `branch_id=eq.${branchId}` : undefined,
    queryKeys: [scheduleQueryKey],
    enabled: Boolean(branchId),
  });
  useRealtimeInvalidate({
    channelName: `admin-schedule-closures-${branchId}`,
    table: "closed_slots",
    filter: branchId ? `branch_id=eq.${branchId}` : undefined,
    queryKeys: [scheduleQueryKey, ["admin", "closures"]],
    enabled: Boolean(branchId),
  });

  const bySection = (scheduleQuery.data ?? []).reduce<Record<string, NonNullable<typeof scheduleQuery.data>>>(
    (acc, slot) => {
      (acc[slot.code] ??= []).push(slot);
      return acc;
    },
    {}
  );

  return (
    <div dir="rtl" lang="ar" className="p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">الجدول اليومي</h1>
        {branchId && (
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="size-4" />
            إغلاق جديد
          </Button>
        )}
      </div>

      <div className="mb-5 flex flex-col gap-3">
        {branchesQuery.isLoading ? (
          <Skeleton className="h-9 w-48" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {(branchesQuery.data ?? []).map((branch) => (
              <button
                key={branch.id}
                onClick={() => setBranchId(branch.id)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  branchId === branch.id ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-accent"
                )}
              >
                {branch.name}
              </button>
            ))}
          </div>
        )}
        <DateStrip selectedDate={date} onSelect={setDate} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {(["available", "locked", "booked", "closed"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", STATUS_DOT[s])} />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      {scheduleQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : scheduleQuery.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <AlertTriangle className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">تعذر تحميل الجدول.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {Object.entries(bySection).map(([code, slots]) => (
            <div key={code} className="rounded-xl border">
              <div className="border-b bg-muted/40 px-3 py-2 text-sm font-semibold">{CODE_LABEL[code] ?? code}</div>
              <div className="flex flex-col gap-1.5 p-3">
                {slots.map((slot) => (
                  <div
                    key={slot.slotStart}
                    title={slot.customerName ?? undefined}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs",
                      STATUS_STYLES[slot.status]
                    )}
                  >
                    <span className="font-medium">{formatTime(slot.slotStart)}</span>
                    <span className="text-muted-foreground">
                      {slot.customerName ? slot.customerName : STATUS_LABEL[slot.status]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {branchId && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold">الإغلاقات في هذا اليوم</h2>
          <ClosuresList branchId={branchId} date={date} />
        </div>
      )}

      {showCreateModal && branchId && (
        <CreateClosureModal branchId={branchId} date={date} onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
