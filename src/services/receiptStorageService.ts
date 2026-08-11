import { supabase } from "@/config/supabase";
import { env } from "@/config/env";

export const ALLOWED_RECEIPT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const MAX_RECEIPT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB — matches the DB check constraint

export type AllowedReceiptMimeType = (typeof ALLOWED_RECEIPT_MIME_TYPES)[number];

export function isAllowedReceiptMimeType(mimeType: string): mimeType is AllowedReceiptMimeType {
  return (ALLOWED_RECEIPT_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Uploads a payment-screenshot file to the payments bucket
 * (`env.supabasePaymentsBucket`) under a per-booking path, and returns the
 * storage_path string to pass to the upload_receipt_metadata RPC.
 *
 * This only handles the binary upload — recording the metadata (and the
 * access_token capability check) is a separate RPC call by design; see
 * docs/BUSINESS_LOGIC.md.
 */
export async function uploadReceiptFile(params: {
  bookingId: string;
  file: File;
}): Promise<{ storagePath: string }> {
  const { bookingId, file } = params;

  const extension = file.name.includes(".") ? file.name.split(".").pop() : undefined;
  const safeExtension = extension ? `.${extension.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}` : "";
  const storagePath = `receipts/${bookingId}/${crypto.randomUUID()}${safeExtension}`;

  const { error } = await supabase.storage.from(env.supabasePaymentsBucket).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) throw error;

  return { storagePath };
}
