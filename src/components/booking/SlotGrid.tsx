import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useSlotGrid, type SlotCell } from "@/hooks/useSlotGrid";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

const STATUS_STYLES: Record<SlotCell["status"], string> = {
  available:
    "border-success/40 bg-success/10 text-foreground hover:border-success hover:bg-success/20 cursor-pointer",
  locked: "border-warning/40 bg-warning/10 text-muted-foreground cursor-not-allowed",
  booked: "border-destructive/30 bg-destructive/10 text-muted-foreground cursor-not-allowed",
};

const STATUS_LABEL: Record<SlotCell["status"], string> = {
  available: "Available",
  locked: "Temporarily held",
  booked: "Booked",
};

export function SlotGrid({
  branchId,
  fieldSectionId,
  date,
  onSelect,
  disabled,
}: {
  branchId: string;
  fieldSectionId: string;
  date: string;
  onSelect: (slot: { slotStart: string; slotEnd: string }) => void;
  disabled?: boolean;
}) {
  const { slots, isLoading, isError, refetch } = useSlotGrid({ branchId, fieldSectionId, date });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
        <AlertTriangle className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Couldn't load time slots. Please try again.</p>
        <button onClick={() => refetch()} className="text-sm font-medium text-primary underline underline-offset-4">
          Retry
        </button>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
        No time slots for this day.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-success" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-warning" /> Temporarily held
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-destructive" /> Booked
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {slots.map((slot) => {
          const isClickable = slot.status === "available" && !disabled;
          return (
            <button
              key={slot.start}
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onSelect({ slotStart: slot.start, slotEnd: slot.end })}
              title={STATUS_LABEL[slot.status]}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors",
                STATUS_STYLES[slot.status],
                disabled && "opacity-60"
              )}
            >
              <span>{formatTime(slot.start)}</span>
              <span className="text-[10px] font-normal opacity-70">{STATUS_LABEL[slot.status]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
