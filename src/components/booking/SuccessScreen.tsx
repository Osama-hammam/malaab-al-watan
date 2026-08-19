import { CheckCircle2, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import type { Branch, FieldSection } from "@/services/branchesService";
import { buildAdminBookingMessage, openWhatsAppWithMessage } from "@/services/whatsappService";

export function SuccessScreen({
  branch,
  section,
  slot,
  price,
  customerName,
  customerPhone,
  bookingReference,
  onStartNewBooking,
}: {
  branch: Branch;
  section: FieldSection;
  slot: { slotStart: string; slotEnd: string };
  price: number;
  customerName: string;
  customerPhone: string;
  bookingReference: string;
  onStartNewBooking: () => void;
}) {
  const handleWhatsApp = () => {
    const msg = buildAdminBookingMessage({
      bookingReference,
      branch,
      section,
      slot,
      price,
      customerName,
      customerPhone,
    });
    // الرقم الذي تم تحديده للإدارة
    openWhatsAppWithMessage("01066328651", msg);
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center gap-6 text-center"
      dir="rtl"
    >
      <div className="flex size-20 items-center justify-center rounded-full bg-success/15 text-success shadow-inner shadow-success/20">
        <CheckCircle2 className="size-10" />
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-3xl font-black tracking-tight text-foreground">تم إرسال طلب الحجز!</h2>
        <p className="mx-auto max-w-sm text-sm font-medium text-muted-foreground leading-relaxed">
          لقد استلمنا إثبات الدفع بنجاح. سيتم مراجعة الطلب وتأكيد حجزك في أقرب وقت.
        </p>
      </div>

      <div className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed bg-muted/40 px-6 py-3">
        <span className="text-xs font-bold text-muted-foreground">رقم الحجز المرجعي</span>
        <span className="font-mono text-xl font-black tracking-widest text-primary">
          {bookingReference}
        </span>
      </div>

      <div className="w-full max-w-md text-right">
        <BookingSummaryCard branch={branch} section={section} slot={slot} price={price} />
      </div>

      <div className="mt-2 flex w-full max-w-md flex-col gap-3">
        <Button onClick={handleWhatsApp} className="h-12 w-full gap-2 rounded-xl bg-green-500 text-base font-bold text-white hover:bg-green-600 active:scale-95">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          إرسال التفاصيل عبر واتساب للإدارة
        </Button>
        <Button onClick={onStartNewBooking} variant="outline" size="lg" className="h-12 w-full gap-2 rounded-xl text-base font-bold transition-all hover:bg-muted active:scale-95">
          <ChevronLeft className="size-5" />
          حجز ملعب آخر
        </Button>
      </div>
    </motion.div>
  );
}
