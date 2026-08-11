/**
 * Hand-written to match the schema actually applied by:
 *   supabase/migrations/20260804000000_phase2_database_architecture.sql
 *   supabase/migrations/20260804010000_phase3_business_logic.sql
 *
 * This has NOT yet been generated from (or applied to) a live Supabase
 * project. Once it is, prefer regenerating this file for anything that
 * drifts:
 *
 *   npx supabase gen types typescript --project-id <your-project-ref> > src/types/database.types.ts
 *
 * Only the tables/functions the frontend actually needs to touch directly
 * are modeled here. Tables written exclusively through RPCs (bookings,
 * booking_locks, payment_receipts, booking_events) are typed as read-only
 * (Insert/Update reuse Row purely to satisfy postgrest-js's structural
 * requirements) — the service layer never calls `.insert()`/`.update()`
 * on them directly, see docs/BUSINESS_LOGIC.md.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type FieldSectionCode = "A" | "B" | "AB";
export type FieldTypeCode = "5v5" | "7v7";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";
export type ReceiptReviewStatus = "pending" | "approved" | "rejected";
export type NotificationStatus = "not_sent" | "queued" | "sent" | "failed";
export type PaymentMethodCode =
  | "vodafone_cash"
  | "instapay"
  | "orange_cash"
  | "bank_transfer";

type BranchRow = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type FieldSectionRow = {
  id: string;
  branch_id: string;
  code: FieldSectionCode;
  field_type: FieldTypeCode;
  price_egp: number;
  conflicts_with: FieldSectionCode[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SettingsRow = {
  key: string;
  value: Json;
  description: string | null;
  is_public: boolean;
  updated_at: string;
  updated_by: string | null;
};

type PaymentMethodRow = {
  code: PaymentMethodCode;
  label_ar: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type BookingRow = {
  id: string;
  branch_id: string;
  field_section_id: string;
  customer_name: string;
  customer_phone: string;
  starts_at: string;
  ends_at: string;
  booking_date: string;
  status: BookingStatus;
  total_price_egp: number;
  notes: string | null;
  access_token: string;
  booking_reference: string | null;
  intended_payment_method: PaymentMethodCode | null;
  notification_status: NotificationStatus;
  notification_sent_at: string | null;
  notification_error: string | null;
  created_at: string;
  updated_at: string;
};

type ClosedSlotRow = {
  id: string;
  branch_id: string;
  field_section_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ClosedSlotInsert = {
  id?: string;
  branch_id: string;
  field_section_id?: string | null;
  starts_at: string;
  ends_at: string;
  reason?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

type PaymentReceiptRow = {
  id: string;
  booking_id: string;
  access_token: string;
  storage_path: string;
  payment_method: PaymentMethodCode;
  mime_type: string;
  file_size_bytes: number;
  review_status: ReceiptReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type UnavailableSlotRow = {
  branch_id: string;
  field_section_id: string | null;
  starts_at: string;
  ends_at: string;
  source: "booking" | "lock" | "closed";
};

export type Database = {
  public: {
    Tables: {
      branches: { Row: BranchRow; Insert: BranchRow; Update: Partial<BranchRow>; Relationships: [] };
      field_sections: {
        Row: FieldSectionRow;
        Insert: FieldSectionRow;
        Update: Partial<FieldSectionRow>;
        Relationships: [];
      };
      settings: { Row: SettingsRow; Insert: SettingsRow; Update: Partial<SettingsRow>; Relationships: [] };
      payment_methods: {
        Row: PaymentMethodRow;
        Insert: PaymentMethodRow;
        Update: Partial<PaymentMethodRow>;
        Relationships: [];
      };
      // Written exclusively through RPCs — modeled read-only in practice.
      bookings: { Row: BookingRow; Insert: BookingRow; Update: Partial<BookingRow>; Relationships: [] };
      payment_receipts: {
        Row: PaymentReceiptRow;
        Insert: PaymentReceiptRow;
        Update: Partial<PaymentReceiptRow>;
        Relationships: [];
      };
      // Admin-managed directly via the client (closed_slots_admin_all
      // RLS reviewed and determined sufficient — see Phase 4.3 migration).
      closed_slots: {
        Row: ClosedSlotRow;
        Insert: ClosedSlotInsert;
        Update: Partial<ClosedSlotInsert>;
        Relationships: [];
      };
    };
    Views: {
      unavailable_slots: { Row: UnavailableSlotRow; Relationships: [] };
    };
    Functions: {
      create_booking_lock: {
        Args: {
          p_field_section_id: string;
          p_starts_at: string;
          p_ends_at: string;
          p_session_id: string;
        };
        Returns: Json;
      };
      release_booking_lock: {
        Args: { p_lock_id: string; p_session_id: string };
        Returns: Json;
      };
      confirm_booking: {
        Args: {
          p_lock_id: string;
          p_session_id: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_intended_payment_method: string | null;
          p_notes: string | null;
        };
        Returns: Json;
      };
      upload_receipt_metadata: {
        Args: {
          p_booking_id: string;
          p_access_token: string;
          p_storage_path: string;
          p_payment_method: string;
          p_mime_type: string;
          p_file_size_bytes: number;
        };
        Returns: Json;
      };
      get_available_slots: {
        Args: { p_field_section_id: string; p_date: string | undefined };
        Returns: { slot_start: string; slot_end: string }[];
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_admin_overview_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_admin_schedule: {
        Args: { p_branch_id: string; p_date: string };
        Returns: {
          field_section_id: string;
          code: FieldSectionCode;
          slot_start: string;
          slot_end: string;
          status: "available" | "locked" | "booked" | "closed";
          booking_id: string | null;
          booking_reference: string | null;
          customer_name: string | null;
          customer_phone: string | null;
        }[];
      };
      get_admin_revenue_report: {
        Args: { p_from_date: string; p_to_date: string; p_branch_id: string | null };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
