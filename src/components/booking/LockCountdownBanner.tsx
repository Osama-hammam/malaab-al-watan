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
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm",
        isUrgent ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-warning/40 bg-warning/10"
      )}
    >
      <span className="flex items-center gap-2 font-medium">
        <TimerReset className="size-4" />
        Your slot is held — complete your booking before the timer runs out
      </span>
      <span className="font-mono text-base font-bold tabular-nums">{label}</span>
    </div>
  );
}
