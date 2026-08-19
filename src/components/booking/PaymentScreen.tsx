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
    toast.success("تم نسخ الرقم بنجاح");
  }

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <BookingSummaryCard branch={branch} section={section} slot={slot} price={price} />

      <Card className="border-2 border-primary/30 bg-primary/5 shadow-sm">
        <CardContent className="flex flex-col gap-4 py-5 px-5">
          <div className="flex items-center gap-2.5 text-base font-black text-foreground">
            <Smartphone className="size-5 text-primary" />
            تحويل {price} ج.م عبر فودافون كاش
          </div>
          
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">
              يرجى تحويل المبلغ إلى الرقم التالي:
            </p>
            {isLoading ? (
              <Skeleton className="h-12 w-48 rounded-xl" />
            ) : (
              <button
                type="button"
                onClick={copyNumber}
                className="flex w-fit items-center gap-3 rounded-xl border-2 border-primary/20 bg-background px-4 py-3 font-mono text-xl font-black tracking-widest text-primary transition-all hover:border-primary/40 active:scale-95"
              >
                <span dir="ltr">{vodafoneNumber}</span>
                <Copy className="size-5 text-muted-foreground" />
              </button>
            )}
          </div>
          
          <p className="text-xs font-semibold text-muted-foreground leading-relaxed bg-muted/50 p-3 rounded-lg">
            ⚠️ هام: بعد إتمام التحويل، يرجى رفع صورة إثبات الدفع (سكرين شوت لرسالة التحويل) ليتم تأكيد حجزك فوراً.
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
