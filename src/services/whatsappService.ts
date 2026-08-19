/**
 * whatsappService.ts
 * Builds and opens WhatsApp messages with booking details using the wa.me deep link.
 * No API key required — works via URL scheme.
 */

import type { FieldSection, Branch } from "@/services/branchesService";

const SECTION_LABEL_AR: Record<string, string> = {
  A: "ملعب 5×5 — الأول",
  B: "ملعب 5×5 — الثاني",
  AB: "ملعب 9×9",
};

function formatArabicTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ar-EG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatArabicDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function calcDurationHours(startIso: string, endIso: string): number {
  const diff = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.round(diff / (1000 * 60 * 60));
}

export interface BookingWhatsAppPayload {
  bookingReference: string;
  branch: Branch;
  section: FieldSection;
  slot: { slotStart: string; slotEnd: string };
  price: number;
  customerName: string;
  customerPhone: string;
}

/**
 * Build the booking notification message (Arabic) to send to management.
 */
export function buildAdminBookingMessage(payload: BookingWhatsAppPayload): string {
  const { bookingReference, branch, section, slot, price, customerName, customerPhone } = payload;
  const duration = calcDurationHours(slot.slotStart, slot.slotEnd);
  const fieldLabel = SECTION_LABEL_AR[section.code] ?? section.code;
  const date = formatArabicDate(slot.slotStart);
  const startTime = formatArabicTime(slot.slotStart);
  const endTime = formatArabicTime(slot.slotEnd);

  return (
    `🏟️ *حجز جديد — ملعب الوطن*\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `🔖 *رقم الحجز:* ${bookingReference}\n\n` +
    `👤 *الاسم:* ${customerName}\n` +
    `📞 *الهاتف:* ${customerPhone}\n\n` +
    `📍 *الموقع:* ${branch.name}\n` +
    `⚽ *الملعب:* ${fieldLabel}\n\n` +
    `📅 *التاريخ:* ${date}\n` +
    `⏰ *الوقت:* ${startTime} — ${endTime}\n` +
    `⏱️ *المدة:* ${duration} ${duration === 1 ? "ساعة" : "ساعات"}\n\n` +
    `💰 *السعر:* ${price} جنيه\n\n` +
    `🕐 *حالة الحجز:* في انتظار التأكيد\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `_تم إرسال إثبات الدفع — يرجى المراجعة والتأكيد_`
  );
}

/**
 * Open WhatsApp with a pre-filled message to the admin number.
 * @param adminPhone - The admin WhatsApp number (digits only, with country code e.g. "201012345678")
 */
export function openWhatsAppWithMessage(adminPhone: string, message: string): void {
  const cleanPhone = adminPhone.replace(/\D/g, "");
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${cleanPhone}?text=${encoded}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
