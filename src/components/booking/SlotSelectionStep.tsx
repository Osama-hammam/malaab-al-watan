import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

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
  const [durationHours, setDurationHours] = useState<number>(1);

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div>
        <p className="mb-3 text-sm font-bold text-muted-foreground">١. اختر اليوم المناسب</p>
        <DateStrip selectedDate={date} onSelect={setDate} />
      </div>

      <div className="border-t border-dashed pt-5">
        <p className="mb-3 text-sm font-bold text-muted-foreground">٢. حدد مدة الحجز</p>
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((hours) => (
            <Button
              key={hours}
              variant={durationHours === hours ? "default" : "outline"}
              onClick={() => setDurationHours(hours)}
              className={`rounded-xl ${durationHours === hours ? "shadow-md" : ""}`}
            >
              <Clock className="mr-2 size-4" />
              {hours === 1 ? "ساعة واحدة" : hours === 2 ? "ساعتين" : "٣ ساعات"}
            </Button>
          ))}
        </div>

        <p className="mb-3 text-sm font-bold text-muted-foreground">٣. حدد وقت بداية الحجز</p>
        <SlotGrid
          branchId={branchId}
          fieldSectionId={fieldSectionId}
          date={date}
          onSelect={onSelectSlot}
          disabled={disabled}
          durationHours={durationHours}
        />
      </div>
    </div>
  );
}
