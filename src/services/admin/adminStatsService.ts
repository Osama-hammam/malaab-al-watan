import { supabase } from "@/config/supabase";
import type { Json } from "@/types/database.types";

export interface AdminOverviewStats {
  todaysBookings: number;
  todaysRevenue: number;
  totalBookings: number;
  pendingReceipts: number;
  confirmedBookings: number;
  cancelledBookings: number;
}

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const { data, error } = await supabase.rpc("get_admin_overview_stats");
  if (error) throw error;

  const result = data as Json as {
    todays_bookings: number;
    todays_revenue: number;
    total_bookings: number;
    pending_receipts: number;
    confirmed_bookings: number;
    cancelled_bookings: number;
  };

  return {
    todaysBookings: result.todays_bookings,
    todaysRevenue: result.todays_revenue,
    totalBookings: result.total_bookings,
    pendingReceipts: result.pending_receipts,
    confirmedBookings: result.confirmed_bookings,
    cancelledBookings: result.cancelled_bookings,
  };
}

export interface RevenueByBranch {
  branchId: string;
  branchName: string;
  revenue: number;
  bookingsCount: number;
}

export interface RevenueByFieldType {
  fieldType: string;
  revenue: number;
  bookingsCount: number;
}

export interface PopularHour {
  hour: number;
  bookingsCount: number;
}

export interface AdminRevenueReport {
  fromDate: string;
  toDate: string;
  totalRevenue: number;
  totalBookings: number;
  byBranch: RevenueByBranch[];
  byFieldType: RevenueByFieldType[];
  popularHours: PopularHour[];
}

export async function getAdminRevenueReport(params: {
  fromDate: string;
  toDate: string;
  branchId?: string | null;
}): Promise<AdminRevenueReport> {
  const { data, error } = await supabase.rpc("get_admin_revenue_report", {
    p_from_date: params.fromDate,
    p_to_date: params.toDate,
    p_branch_id: params.branchId ?? null,
  });
  if (error) throw error;

  const result = data as Json as {
    from_date: string;
    to_date: string;
    total_revenue: number;
    total_bookings: number;
    by_branch: { branch_id: string; branch_name: string; revenue: number; bookings_count: number }[];
    by_field_type: { field_type: string; revenue: number; bookings_count: number }[];
    popular_hours: { hour: number; bookings_count: number }[];
  };

  return {
    fromDate: result.from_date,
    toDate: result.to_date,
    totalRevenue: result.total_revenue,
    totalBookings: result.total_bookings,
    byBranch: result.by_branch.map((r) => ({
      branchId: r.branch_id,
      branchName: r.branch_name,
      revenue: r.revenue,
      bookingsCount: r.bookings_count,
    })),
    byFieldType: result.by_field_type.map((r) => ({
      fieldType: r.field_type,
      revenue: r.revenue,
      bookingsCount: r.bookings_count,
    })),
    popularHours: result.popular_hours.map((r) => ({ hour: r.hour, bookingsCount: r.bookings_count })),
  };
}
