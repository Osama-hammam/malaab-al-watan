import { useQuery } from "@tanstack/react-query";
import { Copy, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import { ReceiptUploader } from "@/components/booking/ReceiptUploader";
import { getVodafoneCashNumber } from "@/services/settingsService";
import type { Branch, FieldSection } from "@/services/branchesService";
import type { PaymentMethodCode } from "@/types/database.types";

export function PaymentScreen({
  branch,
  section,
  slot,
  price,
  onSubmitReceipt,
  isSubmitting,
}: {
  branch: Branch;
  section: FieldSection;
  slot: { slotStart: string; slotEnd: string };
  price: number;
  onSubmitReceipt: (file: File, paymentMethod: PaymentMethodCode) => void;
  isSubmitting: boolean;
}) {
  const { data: vodafoneNumber, isLoading } = useQuery({
    queryKey: ["settings", "vodafone-cash-number"],
    queryFn: getVodafoneCashNumber,
  });

  function copyNumber() {
    if (!vodafoneNumber) return;
    void navigator.clipboard.writeText(vodafoneNumber);
    toast.success("Number copied");
  }

  return (
    <div className="flex flex-col gap-5">
      <BookingSummaryCard branch={branch} section={section} slot={slot} price={price} />

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 py-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Smartphone className="size-4 text-primary" />
            Send {price} EGP via Vodafone Cash
          </div>
          {isLoading ? (
            <Skeleton className="h-9 w-40" />
          ) : (
            <button
              type="button"
              onClick={copyNumber}
              className="flex w-fit items-center gap-2 rounded-lg border border-primary/30 bg-background px-3.5 py-2 font-mono text-lg font-bold tracking-wide"
            >
              {vodafoneNumber}
              <Copy className="size-4 text-muted-foreground" />
            </button>
          )}
          <p className="text-xs text-muted-foreground">
            After sending the payment, upload a screenshot below so we can review and confirm your booking.
          </p>
        </CardContent>
      </Card>

      <ReceiptUploader
        isSubmitting={isSubmitting}
        onSubmit={(file) => onSubmitReceipt(file, "vodafone_cash")}
      />
    </div>
  );
}
