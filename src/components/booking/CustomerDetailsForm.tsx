import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, User, Phone, CheckCircle2, AlignRight } from "lucide-react";

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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" dir="rtl">
      <div className="flex flex-col gap-2">
        <Label htmlFor="customerName" className="font-bold flex items-center gap-1.5">
          <User className="size-4 text-primary" />
          الاسم بالكامل
        </Label>
        <Input id="customerName" placeholder="أحمد مصطفى" className="h-11 rounded-xl" {...register("customerName")} />
        {errors.customerName && <p className="text-xs text-destructive font-medium">{errors.customerName.message}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="customerPhone" className="font-bold flex items-center gap-1.5">
          <Phone className="size-4 text-primary" />
          رقم الهاتف (واتساب)
        </Label>
        <Input id="customerPhone" type="tel" dir="ltr" className="h-11 rounded-xl text-left" placeholder="01000000000" {...register("customerPhone")} />
        {errors.customerPhone && <p className="text-xs text-destructive font-medium">{errors.customerPhone.message}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label className="font-bold flex items-center gap-1.5">
          طريقة الدفع
        </Label>
        <Controller
          name="intendedPaymentMethod"
          control={control}
          render={({ field }) => <PaymentMethodPicker value={field.value} onChange={field.onChange} />}
        />
        {errors.intendedPaymentMethod && (
          <p className="text-xs text-destructive font-medium">{errors.intendedPaymentMethod.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes" className="font-bold flex items-center gap-1.5">
          <AlignRight className="size-4 text-primary" />
          ملاحظات (اختياري)
        </Label>
        <Input id="notes" placeholder="أي ملاحظات إضافية؟" className="h-11 rounded-xl" {...register("notes")} />
        {errors.notes && <p className="text-xs text-destructive font-medium">{errors.notes.message}</p>}
      </div>

      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2 h-12 rounded-xl text-base font-bold shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95">
        {isSubmitting ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <CheckCircle2 className="size-5" />
        )}
        تأكيد بيانات الحجز
      </Button>
    </form>
  );
}
