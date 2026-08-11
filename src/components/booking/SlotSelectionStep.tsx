import { useState } from "react";

import { DateStrip } from "@/components/booking/DateStrip";
import { SlotGrid } from "@/components/booking/SlotGrid";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SlotSelectionStep({
  branchId,
  fieldSectionId,
  onSelectSlot,
  disabled,
}: {
  branchId: string;
  fieldSectionId: string;
  onSelectSlot: (slot: { slotStart: string; slotEnd: string }) => void;
  disabled?: boolean;
}) {
  const [date, setDate] = useState(todayKey);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">Choose a date</p>
        <DateStrip selectedDate={date} onSelect={setDate} />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">Choose a time</p>
        <SlotGrid
          branchId={branchId}
          fieldSectionId={fieldSectionId}
          date={date}
          onSelect={onSelectSlot}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
