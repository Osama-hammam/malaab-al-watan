import type { PoolClient } from "pg";

export interface CreateLockResult {
  lock_id: string;
  expires_at: string;
  countdown_seconds: number;
}

export interface ConfirmBookingResult {
  booking_id: string;
  booking_reference: string;
  access_token: string;
  price: number;
  status: string;
}

export async function callCreateBookingLock(
  client: PoolClient,
  fieldSectionId: string,
  startsAt: string,
  endsAt: string,
  sessionId: string
): Promise<CreateLockResult> {
  const { rows } = await client.query(
    `select public.create_booking_lock($1, $2, $3, $4) as result`,
    [fieldSectionId, startsAt, endsAt, sessionId]
  );
  return rows[0].result as CreateLockResult;
}

export async function callReleaseBookingLock(
  client: PoolClient,
  lockId: string,
  sessionId: string
): Promise<{ released: boolean; lock_id: string }> {
  const { rows } = await client.query(`select public.release_booking_lock($1, $2) as result`, [
    lockId,
    sessionId,
  ]);
  return rows[0].result;
}

export async function callConfirmBooking(
  client: PoolClient,
  lockId: string,
  sessionId: string,
  customerName: string,
  customerPhone: string,
  paymentMethod: string | null = "vodafone_cash",
  notes: string | null = null
): Promise<ConfirmBookingResult> {
  const { rows } = await client.query(
    `select public.confirm_booking($1, $2, $3, $4, $5, $6) as result`,
    [lockId, sessionId, customerName, customerPhone, paymentMethod, notes]
  );
  return rows[0].result as ConfirmBookingResult;
}

export async function callUploadReceiptMetadata(
  client: PoolClient,
  bookingId: string,
  accessToken: string,
  storagePath: string,
  paymentMethod: string,
  mimeType: string,
  fileSizeBytes: number
): Promise<{ receipt_id: string; review_status: string }> {
  const { rows } = await client.query(
    `select public.upload_receipt_metadata($1, $2, $3, $4, $5, $6) as result`,
    [bookingId, accessToken, storagePath, paymentMethod, mimeType, fileSizeBytes]
  );
  return rows[0].result;
}

export async function callGetAvailableSlots(
  client: PoolClient,
  fieldSectionId: string,
  date: string
): Promise<{ slot_start: string; slot_end: string }[]> {
  const { rows } = await client.query(
    `select * from public.get_available_slots($1, $2)`,
    [fieldSectionId, date]
  );
  return rows;
}
