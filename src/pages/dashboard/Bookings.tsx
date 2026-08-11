import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BranchFilter } from "@/components/dashboard/BranchFilter";
import { BookingStatusBadge } from "@/components/dashboard/BookingStatusBadge";
import { BookingDetailModal } from "@/components/dashboard/BookingDetailModal";
import { getAdminBookings, type AdminBooking } from "@/services/admin/adminBookingsService";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import type { BookingStatus } from "@/types/database.types";

const STATUS_FILTERS: { value: BookingStatus | null; label: string }[] = [
  { value: null, label: "الكل" },
  { value: "pending", label: "قيد الانتظار" },
  { value: "confirmed", label: "مؤكد" },
  { value: "completed", label: "مكتمل" },
  { value: "cancelled", label: "ملغي" },
  { value: "no_show", label: "لم يحضر" },
];

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("ar-EG", { month: "short", day: "numeric" })} · ${d.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })}`;
}

export default function DashboardBookings() {
  const [branchId, setBranchId] = useState<string | null>(null);
  const [status, setStatus] = useState<BookingStatus | null>(null);
  const [search, setSearch] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "bookings", branchId, status, search],
    queryFn: () =>
      getAdminBookings({
        branchId: branchId ?? undefined,
        status: status ?? undefined,
        search: search || undefined,
      }),
  });

  useRealtimeInvalidate({
    channelName: "admin-bookings-list",
    table: "bookings",
    queryKeys: [["admin", "bookings"]],
  });
  useRealtimeInvalidate({
    channelName: "admin-bookings-receipts",
    table: "payment_receipts",
    queryKeys: [["admin", "bookings"], ["admin-receipts"]],
  });

  return (
    <div dir="rtl" lang="ar" className="p-4 sm:p-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">الحجوزات</h1>

      <div className="mb-5 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ابحث بالاسم أو رقم الهاتف أو رقم الحجز"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <BranchFilter value={branchId} onChange={setBranchId} />
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setStatus(f.value)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                status === f.value ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-accent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <AlertTriangle className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">تعذر تحميل الحجوزات.</p>
          <button onClick={() => refetch()} className="text-sm font-medium text-primary underline underline-offset-4">
            إعادة المحاولة
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          لا توجد حجوزات مطابقة.
        </div>
      ) : (
        <div className="rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-right font-medium">رقم الحجز</th>
                  <th className="px-4 py-2.5 text-right font-medium">العميل</th>
                  <th className="px-4 py-2.5 text-right font-medium">الموعد</th>
                  <th className="px-4 py-2.5 text-right font-medium">السعر</th>
                  <th className="px-4 py-2.5 text-right font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map((booking) => (
                  <tr
                    key={booking.id}
                    onClick={() => setSelectedBooking(booking)}
                    className="cursor-pointer transition-colors hover:bg-accent/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                      {booking.bookingReference}
                    </td>
                    <td className="px-4 py-3">
                      <div>{booking.customerName}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">
                        {booking.customerPhone}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">{formatDateTime(booking.startsAt)}</td>
                    <td className="px-4 py-3">{booking.totalPriceEgp} ج.م</td>
                    <td className="px-4 py-3">
                      <BookingStatusBadge status={booking.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedBooking && (
        <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      )}
    </div>
  );
}
