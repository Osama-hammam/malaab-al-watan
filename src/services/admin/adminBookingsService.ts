import { supabase } from "@/config/supabase";
import type { BookingStatus, PaymentMethodCode } from "@/types/database.types";

export interface AdminBooking {
  id: string;
  bookingReference: string | null;
  customerName: string;
  customerPhone: string;
  branchId: string;
  fieldSectionId: string;
  startsAt: string;
  endsAt: string;
  bookingDate: string;
  totalPriceEgp: number;
  status: BookingStatus;
  intendedPaymentMethod: PaymentMethodCode | null;
  notes: string | null;
  accessToken: string;
  createdAt: string;
}

export interface AdminBookingFilters {
  status?: BookingStatus;
  branchId?: string;
  fromDate?: string; // booking_date >=
  toDate?: string; // booking_date <=
  search?: string; // matches customer_name, customer_phone, or booking_reference
}

function mapRow(row: {
  id: string;
  booking_reference: string | null;
  customer_name: string;
  customer_phone: string;
  branch_id: string;
  field_section_id: string;
  starts_at: string;
  ends_at: string;
  booking_date: string;
  total_price_egp: number;
  status: BookingStatus;
  intended_payment_method: PaymentMethodCode | null;
  notes: string | null;
  access_token: string;
  created_at: string;
}): AdminBooking {
  return {
    id: row.id,
    bookingReference: row.booking_reference,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    branchId: row.branch_id,
    fieldSectionId: row.field_section_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    bookingDate: row.booking_date,
    totalPriceEgp: row.total_price_egp,
    status: row.status,
    intendedPaymentMethod: row.intended_payment_method,
    notes: row.notes,
    accessToken: row.access_token,
    createdAt: row.created_at,
  };
}

/** Relies entirely on Phase 2's bookings_select_admin_only RLS policy — this query returns zero rows (not an error) for a non-admin caller. */
export async function getAdminBookings(filters: AdminBookingFilters = {}): Promise<AdminBooking[]> {
  let query = supabase.from("bookings").select("*").order("starts_at", { ascending: false }).limit(200);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.branchId) query = query.eq("branch_id", filters.branchId);
  if (filters.fromDate) query = query.gte("booking_date", filters.fromDate);
  if (filters.toDate) query = query.lte("booking_date", filters.toDate);
  if (filters.search) {
    const term = filters.search.trim();
    if (term) {
      query = query.or(
        `customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,booking_reference.ilike.%${term}%`
      );
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getAdminBookingById(id: string): Promise<AdminBooking | null> {
  const { data, error } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

/**
 * Updates a booking's status via the existing bookings_admin_write RLS
 * policy. Deliberately not a new RPC — Phase 3 left status transitions as
 * a manual admin action by design (docs/BUSINESS_LOGIC.md §6 recommendation
 * 7), and the bookings_status_check constraint already restricts values to
 * the valid enum. Any status-change side effects (booking_events logging)
 * happen automatically via the existing AFTER UPDATE trigger.
 */
export async function updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
  if (error) throw error;
}
