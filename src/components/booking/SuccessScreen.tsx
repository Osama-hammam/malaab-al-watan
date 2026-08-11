import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import type { Branch, FieldSection } from "@/services/branchesService";

export function SuccessScreen({
  branch,
  section,
  slot,
  price,
  bookingReference,
  onStartNewBooking,
}: {
  branch: Branch;
  section: FieldSection;
  slot: { slotStart: string; slotEnd: string };
  price: number;
  bookingReference: string;
  onStartNewBooking: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center gap-5 text-center"
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-success/15 text-success">
        <CheckCircle2 className="size-9" />
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Booking submitted!</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          We've received your payment proof. Your booking will be confirmed shortly after review.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/40 px-4 py-2 font-mono text-sm font-semibold tracking-wide">
        {bookingReference}
      </div>

      <div className="w-full max-w-sm">
        <BookingSummaryCard branch={branch} section={section} slot={slot} price={price} />
      </div>

      <Button onClick={onStartNewBooking} variant="outline" size="lg" className="mt-2">
        Book another field
      </Button>
    </motion.div>
  );
}
