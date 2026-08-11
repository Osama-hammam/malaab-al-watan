import { supabase } from "@/config/supabase";
import { toBookingServiceError } from "./errors";
import type { CreateBookingLockResult } from "./types";
import type { Json } from "@/types/database.types";

/**
 * Places a temporary (settings-driven, default 5 minute) hold on a field
 * section + time range. Throws BookingServiceError with kind:
 *  - "conflict"    if the slot is already booked/held/closed
 *  - "validation"  if the time range is outside operating hours
 *  - "not_found"   if the field section doesn't exist
 */
export async function createBookingLock(params: {
  fieldSectionId: string;
  startsAt: Date | string;
  endsAt: Date | string;
  sessionId: string;
}): Promise<CreateBookingLockResult> {
  const { data, error } = await supabase.rpc("create_booking_lock", {
    p_field_section_id: params.fieldSectionId,
    p_starts_at: toIso(params.startsAt),
    p_ends_at: toIso(params.endsAt),
    p_session_id: params.sessionId,
  });

  if (error) throw toBookingServiceError(error);

  const result = data as Json as {
    lock_id: string;
    expires_at: string;
    countdown_seconds: number;
  };

  return {
    lockId: result.lock_id,
    expiresAt: result.expires_at,
    countdownSeconds: result.countdown_seconds,
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
