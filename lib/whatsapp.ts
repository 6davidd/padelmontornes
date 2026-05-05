const WHATSAPP_BASE_URL = "https://wa.me";

export function buildWhatsAppUrl(message: string, phoneNumber?: string) {
  const target = phoneNumber
    ? `${WHATSAPP_BASE_URL}/${phoneNumber}`
    : `${WHATSAPP_BASE_URL}/`;

  return `${target}?text=${encodeURIComponent(message)}`;
}
