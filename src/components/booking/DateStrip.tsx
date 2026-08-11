import { cn } from "@/lib/utils";

const DAYS_AHEAD = 14;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildUpcomingDates(): { key: string; weekday: string; day: number; month: string }[] {
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0); // avoid DST/midnight edge cases when adding days

  return Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    return {
      key: toDateKey(date),
      weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
      day: date.getUTCDate(),
      month: date.toLocaleDateString("en-US", { month: "short" }),
    };
  });
}

export function DateStrip({
  selectedDate,
  onSelect,
}: {
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const dates = buildUpcomingDates();

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {dates.map((d) => {
        const isSelected = d.key === selectedDate;
        return (
          <button
            key={d.key}
            type="button"
            onClick={() => onSelect(d.key)}
            className={cn(
              "flex shrink-0 flex-col items-center gap-0.5 rounded-lg border px-3.5 py-2.5 text-sm transition-colors",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:border-primary/50 hover:bg-accent"
            )}
          >
            <span className="text-[11px] font-medium opacity-80">{d.weekday}</span>
            <span className="text-base font-bold leading-none">{d.day}</span>
            <span className="text-[11px] font-medium opacity-80">{d.month}</span>
          </button>
        );
      })}
    </div>
  );
}
