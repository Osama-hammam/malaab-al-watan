import { useEffect, useState } from "react";

function secondsUntil(expiresAt: string): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

/**
 * Ticks down to `expiresAt`. Because it always recomputes from the
 * absolute timestamp (never a relative "start at 300 and decrement"
 * counter), a page refresh naturally shows the correct remaining time —
 * no special persistence logic needed for the countdown itself, only for
 * which `expiresAt` to resume with (see useBookingFlow).
 */
export function useCountdown(expiresAt: string | null, onExpire?: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(() => (expiresAt ? secondsUntil(expiresAt) : 0));

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(0);
      return;
    }

    setSecondsLeft(secondsUntil(expiresAt));

    const interval = window.setInterval(() => {
      const remaining = secondsUntil(expiresAt);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onExpire intentionally not a dep: re-subscribing on every render of a new inline callback would restart the interval and skew the tick.
  }, [expiresAt]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const label = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return { secondsLeft, isExpired: secondsLeft <= 0, label };
}
