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
      <div className="flex gap-2">
        <Skeleton className="h-11 w-32 rounded-lg" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">No payment methods are available right now.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {data.map((method) => {
        const isSelected = method.code === value;
        return (
          <button
            key={method.code}
            type="button"
            onClick={() => onChange(method.code)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors",
              isSelected
                ? "border-primary bg-primary/10 text-primary"
                : "border-input hover:border-primary/50 hover:bg-accent"
            )}
          >
            <Smartphone className="size-4" />
            <span dir="rtl" lang="ar">
              {method.labelAr}
            </span>
          </button>
        );
      })}
    </div>
  );
}
