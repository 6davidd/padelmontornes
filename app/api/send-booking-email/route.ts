import {
  sendBookingEmail,
  type BookingEmailType,
} from "@/lib/server-booking-email";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Body = {
  type: BookingEmailType;
  to: string;
  memberUserId?: string;
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

    let memberUserId = body.memberUserId;

    if (!memberUserId) {
      const normalizedEmail = to.trim().toLowerCase();
      const memberRes = await supabaseAdmin
        .from("members")
        .select("user_id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (memberRes.error) {
        throw new Error(memberRes.error.message);
      }

      memberUserId = String(memberRes.data?.user_id ?? "");
    }

    const data = await sendBookingEmail({
      ...body,
      memberUserId: memberUserId || undefined,
    });

    return Response.json({ ok: true, data });
  } catch (error) {
    return Response.json({ ok: false, error }, { status: 500 });
  }
}
