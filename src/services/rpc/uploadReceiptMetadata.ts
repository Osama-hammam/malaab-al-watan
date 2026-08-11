import { supabase } from "@/config/supabase";
import { toBookingServiceError } from "./errors";
import type { UploadReceiptMetadataInput, UploadReceiptMetadataResult } from "./types";
import type { Json } from "@/types/database.types";

/**
 * Records payment-receipt metadata for a booking. Call this AFTER
 * uploading the actual file to Supabase Storage — this function only
 * ever handles the `storage_path` string, never binary data.
 *
 * Throws BookingServiceError with kind:
 *  - "unauthorized" if accessToken doesn't match the booking
 *  - "validation"   for an inactive/unsupported payment method, oversized
 *                    file, or unsupported mime type
 *  - "conflict"      if an active (pending/approved) receipt already exists
 *                    for this booking
 */
export async function uploadReceiptMetadata(
  input: UploadReceiptMetadataInput
): Promise<UploadReceiptMetadataResult> {
  const { data, error } = await supabase.rpc("upload_receipt_metadata", {
    p_booking_id: input.bookingId,
    p_access_token: input.accessToken,
    p_storage_path: input.storagePath,
    p_payment_method: input.paymentMethod,
    p_mime_type: input.mimeType,
    p_file_size_bytes: input.fileSizeBytes,
  });

  if (error) throw toBookingServiceError(error);

  const result = data as Json as { receipt_id: string; review_status: UploadReceiptMetadataResult["reviewStatus"] };
  return { receiptId: result.receipt_id, reviewStatus: result.review_status };
}
