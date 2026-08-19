import { useQuery } from "@tanstack/react-query";
import { Smartphone } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getActivePaymentMethods } from "@/services/paymentMethodsService";

export function PaymentMethodPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: getActivePaymentMethods,
  });

  if (isLoading) {
    return (
      <div className="flex gap-2.5">
        <Skeleton className="h-12 w-36 rounded-xl" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">لا توجد طرق دفع متاحة حالياً.</p>;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {data.map((method) => {
        const isSelected = method.code === value;
        return (
          <button
            key={method.code}
            type="button"
            onClick={() => onChange(method.code)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all",
              isSelected
                ? "border-primary bg-primary/10 text-primary scale-105 shadow-sm"
                : "border-input bg-background hover:border-primary/40 hover:bg-muted active:scale-95"
            )}
          >
            <Smartphone className="size-5" />
            <span dir="rtl" lang="ar">
              {method.labelAr}
            </span>
          </button>
        );
      })}
    </div>
  );
}
