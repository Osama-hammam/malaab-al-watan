import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Stable, UI-branchable categories. Multiple SQLSTATE codes can map to the
 * same kind — the frontend should switch on `kind`, not on `sqlState` or
 * (especially not) on the raw `message` text.
 */
export type BookingErrorKind =
  | "validation" // bad input: outside working hours, malformed phone, inactive section/payment method, etc.
  | "conflict" // the slot is already booked/held/closed, or a duplicate receipt exists
  | "lock_invalid" // lock not found, wrong session, or expired
  | "unauthorized" // access_token didn't match the booking
  | "not_found" // referenced id (field_section, booking) doesn't exist
  | "unknown"; // anything not explicitly mapped — network errors, unexpected server issues, etc.

const SQLSTATE_TO_KIND: Record<string, BookingErrorKind> = {
  "23P01": "conflict", // exclusion_violation — overlapping booking/lock/closure
  "23505": "conflict", // unique_violation — duplicate active receipt, reference collision retry exhausted
  "23514": "validation", // check_violation — working hours, inactive section, etc.
  "22023": "validation", // invalid_parameter_value — our own explicit RAISEs for bad input
  "23503": "not_found", // foreign_key_violation — field_section_id/booking_id doesn't exist
  P0002: "lock_invalid", // no_data_found — lock missing/wrong session/expired
  "42501": "unauthorized", // insufficient_privilege — access_token mismatch
};

export class BookingServiceError extends Error {
  readonly kind: BookingErrorKind;
  readonly sqlState: string | null;
  readonly cause?: PostgrestError;

  constructor(message: string, kind: BookingErrorKind, sqlState: string | null, cause?: PostgrestError) {
    super(message);
    this.name = "BookingServiceError";
    this.kind = kind;
    this.sqlState = sqlState;
    this.cause = cause;
  }
}

/** Converts a Supabase/PostgREST error (from an `.rpc()` call) into a typed BookingServiceError. */
export function toBookingServiceError(error: PostgrestError): BookingServiceError {
  const kind = SQLSTATE_TO_KIND[error.code] ?? "unknown";
  return new BookingServiceError(error.message, kind, error.code || null, error);
}
