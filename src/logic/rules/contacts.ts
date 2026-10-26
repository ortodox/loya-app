/** KT1: links behind a phone number – call and the messengers Loya's clients use. */
export type ContactLinks = { call: string; whatsapp: string; telegram: string; viber: string };

/**
 * KT1: «+48 600 123 456» → tel:, WhatsApp, Telegram and Viber links. Messengers need the number in
 * international form; «00» in front counts as «+». Null when there is no usable number.
 */
export function contactLinks(phone: string | null): ContactLinks | null {
  const raw = (phone ?? "").trim();
  let digits = raw.replace(/\D/g, "");
  const international = raw.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 5) return null;
  return {
    call: `tel:${international ? "+" : ""}${digits}`,
    whatsapp: `https://wa.me/${digits}`,
    telegram: `https://t.me/+${digits}`,
    viber: `viber://chat?number=%2B${digits}`,
  };
}
