import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarClock } from "lucide-react";

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
    <PageContainer className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {showBackButton && (
            <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Back">
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <CalendarClock className="size-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Book a Field</h1>
        </div>
      </div>

      <div className="mb-8 overflow-x-auto">
        <StepIndicator current={flow.step} />
      </div>

      {flow.error && (
        <div className="mb-5">
          <ErrorBanner error={flow.error} />
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={flow.step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
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
            <div className="flex flex-col gap-4">
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
                className="self-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Choose a different time
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
              bookingReference={flow.activeBooking.bookingReference}
              onStartNewBooking={flow.startNewBooking}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </PageContainer>
  );
}
