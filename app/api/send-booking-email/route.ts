import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type EmailType = "booking_created" | "added_to_match" | "match_completed";

type Body = {
  type: EmailType;
  to: string;
  fullName?: string;
  addedByName?: string;
  date: string;
  slotStart: string;
  slotEnd: string;
  courtName: string;
  playersCount?: number;
};

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const {
      type,
      to,
      fullName = "",
      addedByName = "",
      date,
      slotStart,
      slotEnd,
      courtName,
      playersCount,
    } = body;

    if (!to || !type || !date || !slotStart || !slotEnd || !courtName) {
      return Response.json(
        { ok: false, error: "Faltan datos obligatorios." },
        { status: 400 }
      );
    }

    let subject = "";
    let html = "";

    if (type === "booking_created") {
      subject = "Reserva confirmada";
      html = `
        <div style="font-family: Arial, sans-serif; color: #111;">
          <h2>Reserva confirmada</h2>
          <p>Hola${fullName ? `, ${esc(fullName)}` : ""}.</p>
          <p>Tu reserva ha sido confirmada correctamente.</p>
          <ul>
            <li><strong>Fecha:</strong> ${esc(date)}</li>
            <li><strong>Horario:</strong> ${esc(slotStart)} - ${esc(slotEnd)}</li>
            <li><strong>Pista:</strong> ${esc(courtName)}</li>
          </ul>
        </div>
      `;
    }

    if (type === "added_to_match") {
      subject = addedByName
        ? `${addedByName} te ha añadido a una partida`
        : "Te han añadido a una partida";

      html = `
        <div style="font-family: Arial, sans-serif; color: #111;">
          <h2>Te han añadido a una partida</h2>
          <p>Hola${fullName ? `, ${esc(fullName)}` : ""}.</p>
          <p>
            ${
              addedByName
                ? `<strong>${esc(addedByName)}</strong> te ha añadido a una partida.`
                : "Se te ha añadido a esta partida."
            }
          </p>
          <ul>
            <li><strong>Fecha:</strong> ${esc(date)}</li>
            <li><strong>Horario:</strong> ${esc(slotStart)} - ${esc(slotEnd)}</li>
            <li><strong>Pista:</strong> ${esc(courtName)}</li>
          </ul>
        </div>
      `;
    }

    if (type === "match_completed") {
      subject = "La partida ya está completa";
      html = `
        <div style="font-family: Arial, sans-serif; color: #111;">
          <h2>La partida ya está completa</h2>
          <p>La partida ya tiene ${playersCount ?? 4} jugadores.</p>
          <ul>
            <li><strong>Fecha:</strong> ${esc(date)}</li>
            <li><strong>Horario:</strong> ${esc(slotStart)} - ${esc(slotEnd)}</li>
            <li><strong>Pista:</strong> ${esc(courtName)}</li>
          </ul>
        </div>
      `;
    }

    const { error, data } = await resend.emails.send({
      from: process.env.EMAIL_FROM as string,
      to,
      subject,
      html,
    });

    if (error) {
      return Response.json({ ok: false, error }, { status: 500 });
    }

    return Response.json({ ok: true, data });
  } catch (error) {
    return Response.json({ ok: false, error }, { status: 500 });
  }
}