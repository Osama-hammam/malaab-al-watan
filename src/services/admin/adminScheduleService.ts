import { supabase } from "@/config/supabase";
import type { FieldSectionCode } from "@/types/database.types";

export type AdminSlotStatus = "available" | "locked" | "booked" | "closed";

export interface AdminScheduleSlot {
  fieldSectionId: string;
  code: FieldSectionCode;
  slotStart: string;
  slotEnd: string;
  status: AdminSlotStatus;
  bookingId: string | null;
  bookingReference: string | null;
  customerName: string | null;
  customerPhone: string | null;
}

/**
 * Full A/B/AB status grid for one branch/day. All conflict logic
 * (including cross-section attribution) is computed by the RPC — this
 * service never re-derives availability itself.
 */
export async function getAdminSchedule(params: {
  branchId: string;
  date: string;
}): Promise<AdminScheduleSlot[]> {
  const { data, error } = await supabase.rpc("get_admin_schedule", {
    p_branch_id: params.branchId,
    p_date: params.date,
  });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    fieldSectionId: row.field_section_id,
    code: row.code,
    slotStart: row.slot_start,
    slotEnd: row.slot_end,
    status: row.status,
    bookingId: row.booking_id,
    bookingReference: row.booking_reference,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
  }));
}
