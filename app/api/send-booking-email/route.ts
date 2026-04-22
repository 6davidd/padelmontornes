import {
  sendBookingEmail,
  type BookingEmailType,
} from "@/lib/server-booking-email";

type Body = {
  type: BookingEmailType;
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const { type, to, date, slotStart, slotEnd, courtName } = body;

    if (!to || !type || !date || !slotStart || !slotEnd || !courtName) {
      return Response.json(
        { ok: false, error: "Faltan datos obligatorios." },
        { status: 400 }
      );
    }

    const data = await sendBookingEmail(body);

    return Response.json({ ok: true, data });
  } catch (error) {
    return Response.json({ ok: false, error }, { status: 500 });
  }
}
