import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BookingStep } from "@/hooks/useBookingFlow";

const STEPS_AR: { step: BookingStep; label: string }[] = [
  { step: "branch", label: "الموقع" },
  { step: "field", label: "الملعب" },
  { step: "slot", label: "الموعد" },
  { step: "details", label: "البيانات" },
  { step: "payment", label: "الدفع" },
  { step: "success", label: "تم" },
];

export function StepIndicator({ current }: { current: BookingStep }) {
  const currentIndex = STEPS_AR.findIndex((s) => s.step === current);

  return (
    <ol dir="rtl" className="flex items-center gap-1 sm:gap-1.5 scrollbar-hide overflow-x-auto pb-1">
      {STEPS_AR.map((item, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <li key={item.step} className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all sm:size-7",
                isDone && "bg-primary text-primary-foreground shadow-sm",
                isCurrent && "bg-primary/20 text-primary ring-2 ring-primary ring-offset-1 ring-offset-background",
                !isDone && !isCurrent && "bg-muted text-muted-foreground"
              )}
            >
              {isDone ? <Check className="size-3.5" /> : index + 1}
            </div>
            <span
              className={cn(
                "text-xs font-bold sm:inline",
                isCurrent ? "text-foreground" : (isDone ? "text-primary" : "text-muted-foreground hidden")
              )}
            >
              {item.label}
            </span>
            {index < STEPS_AR.length - 1 && (
              <div
                className={cn(
                  "h-1 w-3 sm:w-5 mx-0.5 rounded-full transition-colors",
                  isDone ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
