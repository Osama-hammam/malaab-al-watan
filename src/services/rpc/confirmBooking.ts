import { supabase } from "@/config/supabase";
import { toBookingServiceError } from "./errors";
import type { ConfirmBookingInput, ConfirmBookingResult } from "./types";
import type { Json } from "@/types/database.types";

/**
 * Converts a live lock into a real booking (status starts "pending" — an
 * admin later moves it to "confirmed" after reviewing the payment
 * receipt; see docs/BUSINESS_LOGIC.md for the full status workflow).
 * Entirely atomic server-side: verifying the lock, checking expiry,
 * deleting it, generating the booking_reference, and inserting the
 * booking all happen in one transaction.
 *
 * Throws BookingServiceError with kind:
 *  - "lock_invalid"  if the lock doesn't exist, isn't this session's, or expired
 *  - "validation"    if customer_name/phone/payment method are invalid
 *  - "conflict"      in the rare case a reference collision couldn't be resolved
 */
export async function confirmBooking(input: ConfirmBookingInput): Promise<ConfirmBookingResult> {
  const { data, error } = await supabase.rpc("confirm_booking", {
    p_lock_id: input.lockId,
    p_session_id: input.sessionId,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_intended_payment_method: input.intendedPaymentMethod ?? null,
    p_notes: input.notes ?? null,
  });

  if (error) throw toBookingServiceError(error);

  const result = data as Json as {
    booking_id: string;
    booking_reference: string;
    access_token: string;
    price: number;
    status: ConfirmBookingResult["status"];
  };

  return {
    bookingId: result.booking_id,
    bookingReference: result.booking_reference,
    accessToken: result.access_token,
    price: result.price,
    status: result.status,
  };
}
