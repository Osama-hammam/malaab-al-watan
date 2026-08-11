import { supabase } from "@/config/supabase";
import { toBookingServiceError } from "./errors";
import type { ReleaseBookingLockResult } from "./types";
import type { Json } from "@/types/database.types";

/**
 * Releases a hold early (e.g. the customer navigates away). Only succeeds
 * if `sessionId` matches the lock's own — a session can never release
 * another session's lock. Throws BookingServiceError with kind
 * "lock_invalid" if the lock doesn't exist, already expired, or belongs to
 * someone else.
 */
export async function releaseBookingLock(params: {
  lockId: string;
  sessionId: string;
}): Promise<ReleaseBookingLockResult> {
  const { data, error } = await supabase.rpc("release_booking_lock", {
    p_lock_id: params.lockId,
    p_session_id: params.sessionId,
  });

  if (error) throw toBookingServiceError(error);

  const result = data as Json as { released: true; lock_id: string };
  return { released: true, lockId: result.lock_id };
}
