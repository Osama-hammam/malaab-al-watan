import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, X, FileImage, ExternalLink, Phone, MapPin, Calendar, Clock, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BookingStatusBadge } from "@/components/dashboard/BookingStatusBadge";
import { getReceiptsForBooking, getReceiptSignedUrl, reviewReceipt } from "@/services/admin/adminReceiptsService";
import { updateBookingStatus, type AdminBooking } from "@/services/admin/adminBookingsService";
import { useAuth } from "@/context/AuthContext";
import type { BookingStatus } from "@/types/database.types";

const STATUS_OPTIONS: { value: BookingStatus; label: string }[] = [
  { value: "pending", label: "قيد الانتظار" },
  { value: "confirmed", label: "مؤكد" },
  { value: "completed", label: "مكتمل" },
  { value: "cancelled", label: "ملغي" },
  { value: "no_show", label: "لم يحضر" },
];

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("ar-EG", { weekday: "long", month: "long", day: "numeric" }),
    time: d.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" }),
  };
}

function ReceiptViewer({ storagePath }: { storagePath: string }) {
  const { data: url, isLoading } = useQuery({
    queryKey: ["receipt-url", storagePath],
    queryFn: () => getReceiptSignedUrl(storagePath),
  });

  if (isLoading) return <div className="flex h-40 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  if (!url) return null;

  return (
    <a href={url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-lg border">
      <img src={url} alt="إيصال الدفع" className="max-h-64 w-full object-contain bg-muted" />
      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs">
        <ExternalLink className="size-3" /> فتح
      </span>
    </a>
  );
}

export function BookingDetailModal({ booking, onClose }: { booking: AdminBooking; onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<BookingStatus>(booking.status);

  const receiptsQuery = useQuery({
    queryKey: ["admin-receipts", booking.id],
    queryFn: () => getReceiptsForBooking(booking.id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: BookingStatus) => updateBookingStatus(booking.id, status),
    onSuccess: () => {
      toast.success("تم تحديث حالة الحجز");
      void queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "overview-stats"] });
    },
    onError: () => toast.error("تعذر تحديث الحالة"),
  });

  const receiptMutation = useMutation({
    mutationFn: (params: { receiptId: string; status: "approved" | "rejected" }) =>
      reviewReceipt({ receiptId: params.receiptId, reviewStatus: params.status, reviewedBy: user!.id }),
    onSuccess: () => {
      toast.success("تم تحديث حالة الإيصال");
      void queryClient.invalidateQueries({ queryKey: ["admin-receipts", booking.id] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "overview-stats"] });
    },
    onError: () => toast.error("تعذر تحديث حالة الإيصال"),
  });

  const start = formatDateTime(booking.startsAt);
  const end = formatDateTime(booking.endsAt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        dir="rtl"
        lang="ar"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-background shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="font-mono text-sm font-semibold" dir="ltr">
              {booking.bookingReference}
            </p>
            <BookingStatusBadge status={booking.status} />
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-2.5 text-sm">
            <div className="flex items-center gap-2.5">
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              {booking.customerName}
            </div>
            <div className="flex items-center gap-2.5">
              <Phone className="size-4 shrink-0 text-muted-foreground" />
              <span dir="ltr">{booking.customerPhone}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Calendar className="size-4 shrink-0 text-muted-foreground" />
              {start.date}
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              {start.time} – {end.time}
            </div>
            <div className="flex items-center gap-2.5">
              <Wallet className="size-4 shrink-0 text-muted-foreground" />
              {booking.totalPriceEgp} ج.م
            </div>
            {booking.notes && <p className="rounded-md bg-muted/50 px-3 py-2 text-muted-foreground">{booking.notes}</p>}
          </div>

          <div className="mt-5 border-t pt-4">
            <p className="mb-2 text-sm font-medium">تغيير الحالة</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedStatus(opt.value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedStatus === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input hover:bg-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              className="mt-3"
              disabled={selectedStatus === booking.status || statusMutation.isPending}
              onClick={() => statusMutation.mutate(selectedStatus)}
            >
              {statusMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              حفظ الحالة
            </Button>
          </div>

          <div className="mt-5 border-t pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <FileImage className="size-4" /> إيصال الدفع
            </p>
            {receiptsQuery.isLoading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : !receiptsQuery.data || receiptsQuery.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">لم يتم رفع إيصال بعد.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {receiptsQuery.data.map((receipt) => (
                  <div key={receipt.id} className="flex flex-col gap-2">
                    <ReceiptViewer storagePath={receipt.storagePath} />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        حالة المراجعة:{" "}
                        {receipt.reviewStatus === "pending"
                          ? "قيد المراجعة"
                          : receipt.reviewStatus === "approved"
                            ? "مقبول"
                            : "مرفوض"}
                      </span>
                      {receipt.reviewStatus === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={receiptMutation.isPending}
                            onClick={() => receiptMutation.mutate({ receiptId: receipt.id, status: "rejected" })}
                          >
                            رفض
                          </Button>
                          <Button
                            size="sm"
                            disabled={receiptMutation.isPending}
                            onClick={() => receiptMutation.mutate({ receiptId: receipt.id, status: "approved" })}
                          >
                            قبول
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
