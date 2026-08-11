import { z } from "zod";

/**
 * Mirrors the DB-level checks in bookings (customer_name not blank,
 * customer_phone ~ '^\+?[0-9]{8,15}$') so the user gets fast client-side
 * feedback — the RPC still re-validates authoritatively server-side.
 */
export const bookingDetailsSchema = z.object({
  customerName: z.string().trim().min(2, "Enter your full name"),
  customerPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, "Enter a valid phone number (8–15 digits)"),
  intendedPaymentMethod: z.string().min(1, "Choose a payment method"),
  notes: z.string().trim().max(500, "Notes must be under 500 characters").optional(),
});

export type BookingDetailsFormValues = z.infer<typeof bookingDetailsSchema>;
