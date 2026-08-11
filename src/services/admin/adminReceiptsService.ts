import { supabase } from "@/config/supabase";
import { env } from "@/config/env";
import type { PaymentMethodCode, ReceiptReviewStatus } from "@/types/database.types";

export interface AdminReceipt {
  id: string;
  bookingId: string;
  storagePath: string;
  paymentMethod: PaymentMethodCode;
  mimeType: string;
  fileSizeBytes: number;
  reviewStatus: ReceiptReviewStatus;
  reviewedAt: string | null;
  createdAt: string;
}

export async function getReceiptsForBooking(bookingId: string): Promise<AdminReceipt[]> {
  const { data, error } = await supabase
    .from("payment_receipts")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    bookingId: row.booking_id,
    storagePath: row.storage_path,
    paymentMethod: row.payment_method,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    reviewStatus: row.review_status,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  }));
}

/** Generates a temporary signed URL to view a private receipt image/PDF — the bucket is private, so this is the only way to view it. */
export async function getReceiptSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(env.supabasePaymentsBucket)
    .createSignedUrl(storagePath, 60 * 5); // 5 minutes

  if (error) throw error;
  return data.signedUrl;
}

/** Relies on payment_receipts_admin_write RLS. reviewed_by/reviewed_at consistency is enforced by the payment_receipts_reviewed_consistency DB check constraint. */
export async function reviewReceipt(params: {
  receiptId: string;
  reviewStatus: "approved" | "rejected";
  reviewedBy: string;
}): Promise<void> {
  const { error } = await supabase
    .from("payment_receipts")
    .update({
      review_status: params.reviewStatus,
      reviewed_by: params.reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", params.receiptId);

  if (error) throw error;
}
