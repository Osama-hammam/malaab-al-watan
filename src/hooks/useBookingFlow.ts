import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getOrCreateSessionId } from "@/lib/session";
import {
  createBookingLock,
  releaseBookingLock,
  confirmBooking,
  uploadReceiptMetadata,
  BookingServiceError,
} from "@/services/rpc";
import { uploadReceiptFile } from "@/services/receiptStorageService";
import { getActiveBranches, type Branch, type FieldSection } from "@/services/branchesService";
import type { AvailableSlot } from "@/services/rpc";
import type { PaymentMethodCode } from "@/types/database.types";

export type BookingStep = "branch" | "field" | "slot" | "details" | "payment" | "success";

interface ActiveLock {
  lockId: string;
  sessionId: string;
  expiresAt: string;
  branch: Branch;
  section: FieldSection;
  slot: AvailableSlot;
}

interface ActiveBooking {
  bookingId: string;
  bookingReference: string;
  accessToken: string;
  price: number;
  branch: Branch;
  section: FieldSection;
  slot: AvailableSlot;
  customerName: string;
  customerPhone: string;
  /**
   * Tracks whether the receipt upload actually completed. Without this,
   * refreshing during the payment step (after confirm_booking succeeded
   * but before the receipt was uploaded) would silently resume at
   * "success" instead of "payment" — the customer would believe they
   * were done without ever having submitted proof of payment. Found
   * during a UX review, not by a user report.
   */
  receiptUploaded: boolean;
}

const LOCK_STORAGE_KEY = "malaab-al-watan:active-lock";
const BOOKING_STORAGE_KEY = "malaab-al-watan:active-booking";

function readStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function clearStorage(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export interface BookingFlowError {
  message: string;
  kind: BookingServiceError["kind"] | "unknown";
}

function toFlowError(error: unknown): BookingFlowError {
  if (error instanceof BookingServiceError) {
    return { message: error.message, kind: error.kind };
  }
  if (error instanceof Error) {
    return { message: error.message, kind: "unknown" };
  }
  return { message: "Something went wrong. Please try again.", kind: "unknown" };
}

/**
 * Owns the entire customer booking flow: step state, the anonymous
 * session id, the active lock (persisted so a page refresh resumes with
 * the countdown intact — see LOCK_STORAGE_KEY), and every RPC call.
 * Components never call the service layer directly; they call the
 * functions this hook returns.
 */
export function useBookingFlow() {
  const [searchParams] = useSearchParams();
  const [sessionId] = useState(() => getOrCreateSessionId());
  const [step, setStep] = useState<BookingStep>("branch");
  const [branch, setBranch] = useState<Branch | null>(null);
  const [section, setSection] = useState<FieldSection | null>(null);
  const [activeLock, setActiveLock] = useState<ActiveLock | null>(null);
  const [activeBooking, setActiveBooking] = useState<ActiveBooking | null>(null);
  const [error, setError] = useState<BookingFlowError | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Resume state on mount or auto-select branch from URL
  useEffect(() => {
    const savedBooking = readStorage<ActiveBooking>(BOOKING_STORAGE_KEY);
    if (savedBooking) {
      setActiveBooking(savedBooking);
      setBranch(savedBooking.branch);
      setSection(savedBooking.section);
      setStep(savedBooking.receiptUploaded ? "success" : "payment");
      return;
    }

    const savedLock = readStorage<ActiveLock>(LOCK_STORAGE_KEY);
    if (savedLock && new Date(savedLock.expiresAt).getTime() > Date.now()) {
      setActiveLock(savedLock);
      setBranch(savedLock.branch);
      setSection(savedLock.section);
      setStep("details");
      return;
    } else if (savedLock) {
      clearStorage(LOCK_STORAGE_KEY);
    }

    // Check URL query param for branch pre-selection
    const branchParam = searchParams.get("branch");
    if (branchParam) {
      getActiveBranches().then((branches) => {
        const found = branches.find((b) => b.id === branchParam || b.slug === branchParam);
        if (found) {
          setBranch(found);
          setSection(null);
          setStep("field");
        }
      });
    }
  }, [searchParams]);

  const selectBranch = useCallback((selected: Branch) => {
    setError(null);
    setBranch(selected);
    setSection(null);
    setStep("field");
  }, []);

  const selectField = useCallback((selected: FieldSection) => {
    setError(null);
    setSection(selected);
    setStep("slot");
  }, []);

  const selectSlot = useCallback(
    async (slot: AvailableSlot) => {
      if (!branch || !section) return;
      setError(null);
      setIsLocking(true);
      try {
        const lock = await createBookingLock({
          fieldSectionId: section.id,
          startsAt: slot.slotStart,
          endsAt: slot.slotEnd,
          sessionId,
        });
        const record: ActiveLock = {
          lockId: lock.lockId,
          sessionId,
          expiresAt: lock.expiresAt,
          branch,
          section,
          slot,
        };
        setActiveLock(record);
        writeStorage(LOCK_STORAGE_KEY, record);
        setStep("details");
      } catch (e) {
        setError(toFlowError(e));
      } finally {
        setIsLocking(false);
      }
    },
    [branch, section, sessionId]
  );

  /** Releases the current lock (best-effort) and returns to slot selection. Used for "change slot" / "back" and for a user-cancelled hold. */
  const releaseLockAndGoBack = useCallback(async () => {
    if (activeLock) {
      try {
        await releaseBookingLock({ lockId: activeLock.lockId, sessionId: activeLock.sessionId });
      } catch {
        // Best-effort — if it's already gone (e.g. just expired) there's
        // nothing meaningful to surface to the user here.
      }
    }
    clearStorage(LOCK_STORAGE_KEY);
    setActiveLock(null);
    setError(null);
    setStep("slot");
  }, [activeLock]);

  /** Called by the countdown UI when the hold hits zero — no RPC call needed, the row is already inert server-side. */
  const handleLockExpired = useCallback(() => {
    clearStorage(LOCK_STORAGE_KEY);
    setActiveLock(null);
    setError({ message: "Your hold expired. Please choose a time slot again.", kind: "lock_invalid" });
    setStep("slot");
  }, []);

  const submitDetails = useCallback(
    async (details: {
      customerName: string;
      customerPhone: string;
      intendedPaymentMethod: PaymentMethodCode;
      notes?: string;
    }) => {
      if (!activeLock || !branch || !section) return;
      setError(null);
      setIsConfirming(true);
      try {
        const result = await confirmBooking({
          lockId: activeLock.lockId,
          sessionId: activeLock.sessionId,
          customerName: details.customerName,
          customerPhone: details.customerPhone,
          intendedPaymentMethod: details.intendedPaymentMethod,
          notes: details.notes ?? null,
        });

        const record: ActiveBooking = {
          bookingId: result.bookingId,
          bookingReference: result.bookingReference,
          accessToken: result.accessToken,
          price: result.price,
          branch,
          section,
          slot: activeLock.slot,
          customerName: details.customerName,
          customerPhone: details.customerPhone,
          receiptUploaded: false,
        };

        clearStorage(LOCK_STORAGE_KEY);
        setActiveLock(null);
        writeStorage(BOOKING_STORAGE_KEY, record);
        setActiveBooking(record);
        setStep("payment");
      } catch (e) {
        setError(toFlowError(e));
      } finally {
        setIsConfirming(false);
      }
    },
    [activeLock, branch, section]
  );

  const submitReceipt = useCallback(
    async (params: { file: File; paymentMethod: PaymentMethodCode }) => {
      if (!activeBooking) return;
      setError(null);
      setIsUploading(true);
      try {
        const { storagePath } = await uploadReceiptFile({
          bookingId: activeBooking.bookingId,
          file: params.file,
        });
        await uploadReceiptMetadata({
          bookingId: activeBooking.bookingId,
          accessToken: activeBooking.accessToken,
          storagePath,
          paymentMethod: params.paymentMethod,
          mimeType: params.file.type,
          fileSizeBytes: params.file.size,
        });
        const updatedRecord: ActiveBooking = { ...activeBooking, receiptUploaded: true };
        writeStorage(BOOKING_STORAGE_KEY, updatedRecord);
        setActiveBooking(updatedRecord);
        setStep("success");
      } catch (e) {
        setError(toFlowError(e));
      } finally {
        setIsUploading(false);
      }
    },
    [activeBooking]
  );

  const goBackToField = useCallback(() => {
    setError(null);
    setSection(null);
    setStep("field");
  }, []);

  const goBackToBranch = useCallback(() => {
    setError(null);
    setBranch(null);
    setSection(null);
    setStep("branch");
  }, []);

  const startNewBooking = useCallback(() => {
    clearStorage(LOCK_STORAGE_KEY);
    clearStorage(BOOKING_STORAGE_KEY);
    setActiveLock(null);
    setActiveBooking(null);
    setBranch(null);
    setSection(null);
    setError(null);
    setStep("branch");
  }, []);

  return {
    step,
    sessionId,
    branch,
    section,
    activeLock,
    activeBooking,
    error,
    isLocking,
    isConfirming,
    isUploading,
    selectBranch,
    selectField,
    selectSlot,
    releaseLockAndGoBack,
    handleLockExpired,
    submitDetails,
    submitReceipt,
    goBackToField,
    goBackToBranch,
    startNewBooking,
    clearError: () => setError(null),
  };
}

export type UseBookingFlowReturn = ReturnType<typeof useBookingFlow>;
