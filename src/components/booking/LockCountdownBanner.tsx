import { TimerReset } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCountdown } from "@/hooks/useCountdown";

export function LockCountdownBanner({
  expiresAt,
  onExpire,
}: {
  expiresAt: string;
  onExpire: () => void;
}) {
  const { secondsLeft, label } = useCountdown(expiresAt, onExpire);
  const isUrgent = secondsLeft <= 60;

  return (
    <div
      dir="rtl"
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3.5 text-sm shadow-sm transition-colors",
        isUrgent ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-warning/40 bg-warning/10 text-warning-foreground font-semibold"
      )}
    >
      <span className="flex items-center gap-2.5 font-bold">
        <TimerReset className={cn("size-5", isUrgent && "animate-pulse")} />
        الملعب محجوز لك مؤقتاً — يرجى إتمام الدفع قبل انتهاء الوقت
      </span>
      <span className="font-mono text-lg font-black tracking-wider tabular-nums leading-none bg-background/50 px-2.5 py-1 rounded-md">
        {label}
      </span>
    </div>
  );
}
