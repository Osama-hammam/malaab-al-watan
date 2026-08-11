import { supabase } from "@/config/supabase";
import { toBookingServiceError } from "./errors";
import type { AvailableSlot } from "./types";

/**
 * Returns the bookable slots for one field section on one operating day,
 * already excluding confirmed/pending bookings, live locks, and closures
 * — including cross-section conflicts (booking A also removes the
 * overlapping slot from AB's availability, and vice versa).
 *
 * The frontend must call this rather than computing availability itself
 * from raw table data — see docs/BUSINESS_LOGIC.md.
 *
 * @param date defaults to today if omitted. Format: 'YYYY-MM-DD'.
 */
export async function getAvailableSlots(params: {
  fieldSectionId: string;
  date?: string;
}): Promise<AvailableSlot[]> {
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_field_section_id: params.fieldSectionId,
    p_date: params.date,
  });

  if (error) throw toBookingServiceError(error);

  return (data ?? []).map((row) => ({
    slotStart: row.slot_start,
    slotEnd: row.slot_end,
  }));
}
