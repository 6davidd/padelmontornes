import { Resend } from "resend";
import { CLUB_NAME } from "@/lib/brand";
import {
  emailShell,
  formatMatchInfo,
  renderMatchPlayers,
  escapeHtml,
} from "@/lib/email-templates";

const resend = new Resend(process.env.RESEND_API_KEY);

type EmailType =
  | "booking_created"
  | "added_to_match"
  | "match_completed"
  | "admin_opened_match";

type Body = {
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const {
      type,
      to,
      fullName = "",
      addedByName = "",
      openedByName = "",
      date,
      slotStart,
      slotEnd,
      courtName,
      playersCount,
      players = [],
    } = body;

    if (!to || !type || !date || !slotStart || !slotEnd || !courtName) {
      return Response.json(
        { ok: false, error: "Faltan datos obligatorios." },
        { status: 400 }
      );
    }

    const helloName = fullName ? `, ${fullName}` : "";
    const schedule = `${slotStart} - ${slotEnd}`;
    const matchDetails = formatMatchInfo({
      date,
      slotStart,
      slotEnd,
      courtName,
      playersCount,
    });

    let subject = "";
    let html = "";

    // BOOKING_CREATED: Usuario hace su primera reserva
    if (type === "booking_created") {
      subject = `🎾 Reserva confirmada · ${courtName} · ${slotStart}`;
      html = emailShell({
        preheader: "Tu reserva ha sido confirmada correctamente.",
        title: "Reserva confirmada",
        intro: `Tu reserva está guardada${helloName}. Esperamos que se apunte más gente para completar la partida.`,
        badge: "Todo listo",
        matchDetailsHtml: matchDetails,
        footer: "Si se apunta más gente, la partida irá cogiendo forma. ¡A disfrutar! 🎾",
        clubName: CLUB_NAME,
      });
    }

    // ADDED_TO_MATCH: Admin o alguien agrega el usuario a una partida existente
    if (type === "added_to_match") {
      subject = addedByName
        ? `🎾 ${addedByName} te ha añadido a una partida`
        : "🎾 Te han añadido a una partida";

      const addedByText = addedByName
        ? `<strong>${escapeHtml(addedByName)}</strong> te ha añadido a una partida`
        : "Se te ha añadido a una partida del club";

      html = emailShell({
        preheader: "Te han añadido a una partida del club.",
        title: "Nueva partida",
        intro: `${addedByText}${helloName}.`,
        badge: `${players.length || 1}/4 jugadores`,
        matchDetailsHtml: matchDetails,
        extraHtml: renderMatchPlayers(players),
        footer: "Revisa la app para ver quién más va a jugar.",
        clubName: CLUB_NAME,
      });
    }

    // ADMIN_OPENED_MATCH: Admin abre una partida para un usuario específico
    if (type === "admin_opened_match") {
      subject = openedByName
        ? `🎾 ${openedByName} ha abierto una partida para ti`
        : `🎾 Han abierto una partida para ti`;

      const openedByText = openedByName
        ? `<strong>${escapeHtml(openedByName)}</strong> ha abierto una partida para ti`
        : "Han abierto una partida para ti en el club";

      html = emailShell({
        preheader: "Han abierto una partida para ti en el club.",
        title: "Partida abierta",
        intro: `${openedByText}${helloName}.`,
        badge: `${players.length || 1}/4 jugadores`,
        matchDetailsHtml: matchDetails,
        extraHtml: renderMatchPlayers(players),
        footer: "Entra en la app para confirmar tu asistencia.",
        clubName: CLUB_NAME,
      });
    }

    // MATCH_COMPLETED: La partida está completa (4/4 jugadores)
    if (type === "match_completed") {
      subject = `🎾 Partida completa · ${courtName} · ${slotStart}`;
      html = emailShell({
        preheader: "La partida ya está completa.",
        title: "Partida completa",
        intro: `La partida está completa${helloName}. Ya están los 4 jugadores confirmados.`,
        badge: `${playersCount ?? 4}/4 jugadores`,
        matchDetailsHtml: matchDetails,
        extraHtml: renderMatchPlayers(players, "Integrantes"),
        footer: "¡Buen partido y a disfrutar de la pista! 🎾",
        clubName: CLUB_NAME,
      });
    }

    if (!subject || !html) {
      return Response.json(
        { ok: false, error: "Tipo de email no válido." },
        { status: 400 }
      );
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
