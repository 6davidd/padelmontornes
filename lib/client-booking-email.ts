type EmailType =
  | "booking_created"
  | "added_to_match"
  | "match_completed"
  | "admin_opened_match";

type BookingEmailPayload = {
  type: EmailType;
  to: string;
  fullName?: string;
  addedByName?: string;
  openedByName?: string;
  date: string;
  slotStart: string;
  slotEnd: string;
  courtName: string;
  playersCount?: number;
  players?: string[];
};

export function queueBookingEmail(payload: BookingEmailPayload) {
  void fetch("/api/send-booking-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch((error) => {
    console.error("Error enviando email:", error);
  });
}

export function queueBookingEmails(payloads: BookingEmailPayload[]) {
  for (const payload of payloads) {
    queueBookingEmail(payload);
  }
}
