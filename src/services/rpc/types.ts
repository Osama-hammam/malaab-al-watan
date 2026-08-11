import type { PaymentMethodCode, BookingStatus, ReceiptReviewStatus } from "@/types/database.types";

export interface CreateBookingLockResult {
  lockId: string;
  expiresAt: string;
  countdownSeconds: number;
}

export interface ReleaseBookingLockResult {
  released: true;
  lockId: string;
}

export interface ConfirmBookingResult {
  bookingId: string;
  bookingReference: string;
  accessToken: string;
  price: number;
  status: BookingStatus;
}

export interface UploadReceiptMetadataResult {
  receiptId: string;
  reviewStatus: ReceiptReviewStatus;
}

export interface AvailableSlot {
  slotStart: string;
  slotEnd: string;
}

export interface ConfirmBookingInput {
  lockId: string;
  sessionId: string;
  customerName: string;
  customerPhone: string;
  intendedPaymentMethod?: PaymentMethodCode | null;
  notes?: string | null;
}

export interface UploadReceiptMetadataInput {
  bookingId: string;
  accessToken: string;
  storagePath: string;
  paymentMethod: PaymentMethodCode;
  mimeType: string;
  fileSizeBytes: number;
}
