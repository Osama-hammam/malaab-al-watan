import { AlertTriangle, Clock, Lock, ShieldAlert } from "lucide-react";

import type { BookingFlowError } from "@/hooks/useBookingFlow";

const ICONS: Record<BookingFlowError["kind"], typeof AlertTriangle> = {
  conflict: Clock,
  validation: AlertTriangle,
  lock_invalid: Lock,
  unauthorized: ShieldAlert,
  not_found: AlertTriangle,
  unknown: AlertTriangle,
};

export function ErrorBanner({ error }: { error: BookingFlowError }) {
  const Icon = ICONS[error.kind];

  return (
    <div
      role="alert"
      dir="rtl"
      className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-sm font-bold text-destructive shadow-sm"
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span className="leading-relaxed">{error.message}</span>
    </div>
  );
}
