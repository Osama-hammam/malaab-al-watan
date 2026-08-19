import { AlertTriangle, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useSlotGrid, type SlotCell } from "@/hooks/useSlotGrid";

function formatArabicTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit", hour12: true });
}

const STATUS_STYLES: Record<SlotCell["status"], string> = {
  available:
    "border-success/40 bg-success/10 text-foreground hover:border-success hover:bg-success/20 cursor-pointer shadow-sm",
  locked: "border-warning/40 bg-warning/10 text-warning-foreground cursor-not-allowed opacity-80",
  booked: "border-destructive/30 bg-destructive/10 text-destructive-foreground cursor-not-allowed opacity-70",
};

const STATUS_LABEL_AR: Record<SlotCell["status"], string> = {
  available: "متاح للحجز",
  locked: "قيد الدفع حالياً",
  booked: "محجوز",
};

export function SlotGrid({
  branchId,
  fieldSectionId,
  date,
  onSelect,
  disabled,
  durationHours = 1,
}: {
  branchId: string;
  fieldSectionId: string;
  date: string;
  onSelect: (slot: { slotStart: string; slotEnd: string }) => void;
  disabled?: boolean;
  durationHours?: number;
}) {
  const { slots, isLoading, isError, refetch } = useSlotGrid({ branchId, fieldSectionId, date });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-10 text-center">
        <AlertTriangle className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">تعذر تحميل المواعيد. حاول مجدداً.</p>
        <button onClick={() => refetch()} className="text-sm font-semibold text-primary underline underline-offset-4">
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
        لا توجد مواعيد متاحة في هذا اليوم.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-muted/40 p-3 text-xs font-medium text-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-success shadow-sm" /> متاح للحجز
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-warning shadow-sm" /> قيد الدفع (مؤقت)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-destructive shadow-sm" /> محجوز
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {slots.map((slot, index) => {
          let isAvailableForDuration = true;
          for (let i = 0; i < durationHours; i++) {
            if (!slots[index + i] || slots[index + i].status !== "available") {
              isAvailableForDuration = false;
              break;
            }
          }
          
          const isClickable = isAvailableForDuration && !disabled;
          
          const handleSelect = () => {
             if (isClickable) {
                const endSlot = slots[index + durationHours - 1];
                onSelect({ slotStart: slot.start, slotEnd: endSlot.end });
             }
          };

          return (
            <button
              key={slot.start}
              type="button"
              disabled={!isClickable}
              onClick={handleSelect}
              title={STATUS_LABEL_AR[slot.status]}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-3 transition-all",
                STATUS_STYLES[slot.status],
                isClickable && "active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                disabled && "opacity-50 grayscale-[30%]"
              )}
            >
              <div className="flex items-center gap-1.5 font-bold">
                <Clock className="size-3.5 opacity-70" />
                <span dir="ltr">{formatArabicTime(slot.start)}</span>
              </div>
              <span className="text-[10px] font-semibold opacity-80">{STATUS_LABEL_AR[slot.status]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
