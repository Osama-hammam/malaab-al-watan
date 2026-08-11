import { LockCountdownBanner } from "@/components/booking/LockCountdownBanner";
import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import { CustomerDetailsForm } from "@/components/booking/CustomerDetailsForm";
import type { Branch, FieldSection } from "@/services/branchesService";
import type { PaymentMethodCode } from "@/types/database.types";

export function DetailsStep({
  branch,
  section,
  slot,
  expiresAt,
  onExpire,
  onSubmit,
  isSubmitting,
}: {
  branch: Branch;
  section: FieldSection;
  slot: { slotStart: string; slotEnd: string };
  expiresAt: string;
  onExpire: () => void;
  onSubmit: (values: {
    customerName: string;
    customerPhone: string;
    intendedPaymentMethod: PaymentMethodCode;
    notes?: string;
  }) => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <LockCountdownBanner expiresAt={expiresAt} onExpire={onExpire} />
      <BookingSummaryCard branch={branch} section={section} slot={slot} />
      <CustomerDetailsForm
        isSubmitting={isSubmitting}
        onSubmit={(values) =>
          onSubmit({
            ...values,
            intendedPaymentMethod: values.intendedPaymentMethod as PaymentMethodCode,
          })
        }
      />
    </div>
  );
}
