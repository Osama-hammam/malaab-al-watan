import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, CalendarClock } from "lucide-react";

import { PageContainer } from "@/components/common/PageContainer";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/booking/StepIndicator";
import { ErrorBanner } from "@/components/booking/ErrorBanner";
import { BranchGrid } from "@/components/booking/BranchGrid";
import { SectionGrid } from "@/components/booking/SectionGrid";
import { SlotSelectionStep } from "@/components/booking/SlotSelectionStep";
import { DetailsStep } from "@/components/booking/DetailsStep";
import { PaymentScreen } from "@/components/booking/PaymentScreen";
import { SuccessScreen } from "@/components/booking/SuccessScreen";
import { useBookingFlow } from "@/hooks/useBookingFlow";

export default function Booking() {
  const flow = useBookingFlow();

  const showBackButton = flow.step === "field" || flow.step === "slot";

  function handleBack() {
    if (flow.step === "field") flow.goBackToBranch();
    else if (flow.step === "slot") flow.goBackToField();
  }

  return (
    <PageContainer className="max-w-3xl" dir="rtl" lang="ar">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Button variant="ghost" size="icon" onClick={handleBack} aria-label="العودة" className="rounded-xl hover:bg-muted">
              <ChevronRight className="size-5" />
            </Button>
          )}
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarClock className="size-5" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">حجز ملعب</h1>
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded-2xl border-2 bg-card p-4 shadow-sm">
        <StepIndicator current={flow.step} />
      </div>

      {flow.error && (
        <div className="mb-6">
          <ErrorBanner error={flow.error} />
        </div>
      )}

      <div className="rounded-3xl border-2 bg-card p-5 sm:p-7 shadow-sm">
        <AnimatePresence mode="wait">
          <motion.div
            key={flow.step}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.25 }}
          >
            {flow.step === "branch" && <BranchGrid onSelect={flow.selectBranch} />}

            {flow.step === "field" && flow.branch && (
              <SectionGrid branchId={flow.branch.id} onSelect={flow.selectField} />
            )}

            {flow.step === "slot" && flow.branch && flow.section && (
              <SlotSelectionStep
                branchId={flow.branch.id}
                fieldSectionId={flow.section.id}
                onSelectSlot={flow.selectSlot}
                disabled={flow.isLocking}
              />
            )}

            {flow.step === "details" && flow.branch && flow.section && flow.activeLock && (
              <div className="flex flex-col gap-5">
                <DetailsStep
                  branch={flow.branch}
                  section={flow.section}
                  slot={flow.activeLock.slot}
                  expiresAt={flow.activeLock.expiresAt}
                  onExpire={flow.handleLockExpired}
                  onSubmit={flow.submitDetails}
                  isSubmitting={flow.isConfirming}
                />
                <button
                  type="button"
                  onClick={() => void flow.releaseLockAndGoBack()}
                  className="self-center text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-primary transition-colors"
                >
                  العودة لتغيير الموعد
                </button>
              </div>
            )}

            {flow.step === "payment" && flow.branch && flow.section && flow.activeBooking && (
              <PaymentScreen
                branch={flow.branch}
                section={flow.section}
                slot={flow.activeBooking.slot}
                price={flow.activeBooking.price}
                onSubmitReceipt={(file, paymentMethod) => void flow.submitReceipt({ file, paymentMethod })}
                isSubmitting={flow.isUploading}
              />
            )}

            {flow.step === "success" && flow.branch && flow.section && flow.activeBooking && (
              <SuccessScreen
                branch={flow.branch}
                section={flow.section}
                slot={flow.activeBooking.slot}
                price={flow.activeBooking.price}
                customerName={flow.activeBooking.customerName || "عميل ملعب الوطن"}
                customerPhone={flow.activeBooking.customerPhone}
                bookingReference={flow.activeBooking.bookingReference}
                onStartNewBooking={flow.startNewBooking}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </PageContainer>
  );
}
