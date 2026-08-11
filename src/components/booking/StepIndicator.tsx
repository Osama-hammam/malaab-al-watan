import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BookingStep } from "@/hooks/useBookingFlow";

const STEPS: { step: BookingStep; label: string }[] = [
  { step: "branch", label: "Branch" },
  { step: "field", label: "Field" },
  { step: "slot", label: "Time" },
  { step: "details", label: "Details" },
  { step: "payment", label: "Payment" },
  { step: "success", label: "Done" },
];

export function StepIndicator({ current }: { current: BookingStep }) {
  const currentIndex = STEPS.findIndex((s) => s.step === current);

  return (
    <ol className="flex items-center gap-1.5 sm:gap-2">
      {STEPS.map((item, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <li key={item.step} className="flex items-center gap-1.5 sm:gap-2">
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors sm:size-7",
                isDone && "bg-primary text-primary-foreground",
                isCurrent && "bg-primary/15 text-primary ring-2 ring-primary",
                !isDone && !isCurrent && "bg-muted text-muted-foreground"
              )}
            >
              {isDone ? <Check className="size-3.5" /> : index + 1}
            </div>
            <span
              className={cn(
                "hidden text-xs font-medium sm:inline",
                isCurrent ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {item.label}
            </span>
            {index < STEPS.length - 1 && <div className="h-px w-3 bg-border sm:w-6" />}
          </li>
        );
      })}
    </ol>
  );
}
