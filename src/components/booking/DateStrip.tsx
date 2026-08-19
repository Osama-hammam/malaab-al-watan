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
      weekday: date.toLocaleDateString("ar-EG", { weekday: "long" }).split(' ')[0], // e.g. "الأحد"
      day: date.getUTCDate(),
      month: date.toLocaleDateString("ar-EG", { month: "short" }),
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
    <div className="flex gap-2.5 overflow-x-auto pb-4 scrollbar-hide">
      {dates.map((d) => {
        const isSelected = d.key === selectedDate;
        return (
          <button
            key={d.key}
            type="button"
            onClick={() => onSelect(d.key)}
            className={cn(
              "flex shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-4 py-3 min-w-[72px] transition-all",
              isSelected
                ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                : "border-input bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted active:scale-95"
            )}
          >
            <span className={cn("text-[10px] font-bold", isSelected ? "opacity-90" : "opacity-60")}>{d.weekday}</span>
            <span className="text-xl font-black leading-none">{d.day}</span>
            <span className={cn("text-[11px] font-semibold", isSelected ? "opacity-90" : "opacity-60")}>{d.month}</span>
          </button>
        );
      })}
    </div>
  );
}
