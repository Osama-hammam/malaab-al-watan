import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentMethodPicker } from "@/components/booking/PaymentMethodPicker";
import { bookingDetailsSchema, type BookingDetailsFormValues } from "@/schemas/bookingDetails.schema";

export function CustomerDetailsForm({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (values: BookingDetailsFormValues) => void;
  isSubmitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<BookingDetailsFormValues>({
    resolver: zodResolver(bookingDetailsSchema),
    defaultValues: { customerName: "", customerPhone: "", intendedPaymentMethod: "", notes: "" },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="customerName">Full name</Label>
        <Input id="customerName" placeholder="Ahmed Mostafa" {...register("customerName")} />
        {errors.customerName && <p className="text-xs text-destructive">{errors.customerName.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="customerPhone">Phone number</Label>
        <Input id="customerPhone" type="tel" placeholder="+201234567890" {...register("customerPhone")} />
        {errors.customerPhone && <p className="text-xs text-destructive">{errors.customerPhone.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Payment method</Label>
        <Controller
          name="intendedPaymentMethod"
          control={control}
          render={({ field }) => <PaymentMethodPicker value={field.value} onChange={field.onChange} />}
        />
        {errors.intendedPaymentMethod && (
          <p className="text-xs text-destructive">{errors.intendedPaymentMethod.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input id="notes" placeholder="Anything we should know?" {...register("notes")} />
        {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
      </div>

      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1">
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Confirm booking
      </Button>
    </form>
  );
}
