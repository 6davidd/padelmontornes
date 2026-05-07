import "server-only";

import { Resend } from "resend";
import { CLUB_NAME } from "@/lib/brand";
import {
  emailShell,
  formatEmailSubjectSchedule,
  formatMatchInfo,
  renderMatchPlayers,
  escapeHtml,
} from "@/lib/email-templates";

export type BookingEmailType =
  | "booking_created"
  | "added_to_match"
  | "match_completed"
  | "admin_opened_match";

export type BookingEmailPayload = {
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

function buildBookingEmail(payload: BookingEmailPayload) {
  const {
    type,
    fullName = "",
    addedByName = "",
    openedByName = "",
    date,
    slotStart,
    slotEnd,
    courtName,
    playersCount,
    players = [],
  } = payload;

  const helloName = fullName ? `, ${fullName}` : "";
  const subjectSchedule = formatEmailSubjectSchedule(date, slotStart);
  const matchDetails = formatMatchInfo({
    date,
    slotStart,
    slotEnd,
    courtName,
    playersCount,
  });

  if (type === "booking_created") {
    return {
      subject: `🎾 Reserva confirmada · ${subjectSchedule}`,
      html: emailShell({
        preheader: "Tu reserva ha sido confirmada correctamente.",
        title: "Reserva confirmada",
        intro: `Tu reserva está guardada${helloName}. Esperamos que se apunte más gente para completar la partida.`,
        matchDetailsHtml: matchDetails,
        footer:
          "Si se apunta más gente, la partida irá cogiendo forma. ¡A disfrutar! 🎾",
        clubName: CLUB_NAME,
      }),
    };
  }

  if (type === "added_to_match") {
    const subject = addedByName
      ? `🎾 ${addedByName} te ha añadido · ${subjectSchedule}`
      : `🎾 Te han añadido · ${subjectSchedule}`;

    const addedByText = addedByName
      ? `<strong>${escapeHtml(addedByName)}</strong> te ha añadido a una partida`
      : "Se te ha añadido a una partida del club";

    return {
      subject,
      html: emailShell({
        preheader: "Te han añadido a una partida del club.",
        title: "Nueva partida",
        intro: `${addedByText}${helloName}.`,
        badge: `${players.length || 1}/4 jugadores`,
        matchDetailsHtml: matchDetails,
        extraHtml: renderMatchPlayers(players),
        footer: "Revisa la app para ver quién más va a jugar.",
        clubName: CLUB_NAME,
      }),
    };
  }

  if (type === "admin_opened_match") {
    const subject = openedByName
      ? `🎾 ${openedByName} ha abierto partida · ${subjectSchedule}`
      : `🎾 Partida abierta · ${subjectSchedule}`;

    const openedByText = openedByName
      ? `<strong>${escapeHtml(openedByName)}</strong> ha abierto una partida para ti`
      : "Han abierto una partida para ti en el club";

    return {
      subject,
      html: emailShell({
        preheader: "Han abierto una partida para ti en el club.",
        title: "Partida abierta",
        intro: `${openedByText}${helloName}.`,
        badge: `${players.length || 1}/4 jugadores`,
        matchDetailsHtml: matchDetails,
        extraHtml: renderMatchPlayers(players),
        footer: "Entra en la app para confirmar tu asistencia.",
        clubName: CLUB_NAME,
      }),
    };
  }

  if (type === "match_completed") {
    return {
      subject: `🎾 Partida completa · ${subjectSchedule}`,
      html: emailShell({
        preheader: "La partida ya está completa.",
        title: "Partida completa",
        intro: `La partida está completa${helloName}. Ya están los 4 jugadores confirmados.`,
        badge: `${playersCount ?? 4}/4 jugadores`,
        matchDetailsHtml: matchDetails,
        extraHtml: renderMatchPlayers(players, "Integrantes"),
        footer: "¡Buen partido y a disfrutar de la pista! 🎾",
        clubName: CLUB_NAME,
      }),
    };
  }

  throw new Error("Tipo de email no válido.");
}

export async function sendBookingEmail(payload: BookingEmailPayload) {
  if (
    !payload.to ||
    !payload.type ||
    !payload.date ||
    !payload.slotStart ||
    !payload.slotEnd ||
    !payload.courtName
  ) {
    throw new Error("Faltan datos obligatorios.");
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error("Falta configurar RESEND_API_KEY o EMAIL_FROM.");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { subject, html } = buildBookingEmail(payload);

  const { error, data } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: payload.to,
    subject,
    html,
  });

  if (error) {
    throw new Error(
      typeof error === "string" ? error : "No se ha podido enviar el email."
    );
  }

  return data;
}
