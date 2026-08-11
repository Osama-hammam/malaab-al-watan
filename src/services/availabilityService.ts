import { supabase } from "@/config/supabase";

export type UnavailabilitySource = "booking" | "lock" | "closed";

export interface UnavailableSlot {
  fieldSectionId: string | null;
  startsAt: string;
  endsAt: string;
  source: UnavailabilitySource;
}

/**
 * Returns raw unavailability rows (bookings/locks/closures) for a branch on
 * one operating day. This is PRESENTATIONAL ONLY — used to color a
 * non-clickable slot yellow ("temporarily locked") vs red ("booked/closed")
 * in the UI. It must never be used to decide what a customer *can* click;
 * that determination always comes from the get_available_slots RPC, which
 * already correctly accounts for cross-section conflicts (e.g. an A
 * booking making AB unavailable). This view does not resolve those
 * cross-section relationships itself, so a slot unavailable only because of
 * a *related* section will fall back to "booked" (red) here rather than
 * being mis-colored as available — see getSlotColor in useBookingFlow.
 */
export async function getUnavailableSlotsForBranch(params: {
  branchId: string;
  dayStart: string;
  dayEnd: string;
}): Promise<UnavailableSlot[]> {
  const { data, error } = await supabase
    .from("unavailable_slots")
    .select("field_section_id, starts_at, ends_at, source")
    .eq("branch_id", params.branchId)
    .lt("starts_at", params.dayEnd)
    .gt("ends_at", params.dayStart);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    fieldSectionId: row.field_section_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    source: row.source,
  }));
}
