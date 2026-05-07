import "server-only";

import { CLUB_NAME } from "@/lib/brand";
import {
  emailShell,
  escapeHtml,
  formatEmailSubjectSchedule,
  matchInfoRow,
} from "@/lib/email-templates";
import { getAppUrl, getDailySummaryRecipients } from "@/lib/server-email-config";
import { getResendClient } from "@/lib/server-resend";
import { formatSpanishWeekdayDay, toHM } from "@/lib/spanish-date";
import { supabaseAdmin } from "@/lib/supabase-admin";

const FULL_COURTS_REQUIRED = 3;
const PLAYERS_PER_FULL_COURT = 4;

type ReservationRow = {
  id: string;
  court_id: number;
};

type PlayerRow = {
  reservation_id: string;
};

type AlertInsertRow = {
  id: string;
  token: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isUniqueViolation(error: { code?: string; message?: string | null }) {
  return (
    error.code === "23505" ||
    (error.message ?? "").toLocaleLowerCase("es-ES").includes("duplicate")
  );
}

export function buildAllCourtsFullWhatsappMessage(params: {
  date: string;
  slotStart: string;
}) {
  return `*${formatSpanishWeekdayDay(params.date)} a las ${toHM(
    params.slotStart
  )} todo lleno, no se pueden coger mas pistas a esa hora.*`;
}

async function hasThreeFullCourts(params: {
  date: string;
  slotStart: string;
  slotEnd: string;
}) {
  const { date, slotStart, slotEnd } = params;

  const reservationsRes = await supabaseAdmin
    .from("reservations")
    .select("id,court_id")
    .eq("date", date)
    .eq("slot_start", slotStart)
    .eq("slot_end", slotEnd)
    .eq("status", "active");

  if (reservationsRes.error) {
    throw new Error(
      `Error comprobando reservas completas: ${reservationsRes.error.message}`
    );
  }

  const reservations = (reservationsRes.data ?? []) as ReservationRow[];

  if (reservations.length < FULL_COURTS_REQUIRED) {
    return false;
  }

  const reservationIds = reservations.map((reservation) => reservation.id);
  const playersRes = await supabaseAdmin
    .from("reservation_players")
    .select("reservation_id")
    .in("reservation_id", reservationIds);

  if (playersRes.error) {
    throw new Error(
      `Error comprobando jugadores de reservas completas: ${playersRes.error.message}`
    );
  }

  const playerCounts = new Map<string, number>();
  for (const player of (playersRes.data ?? []) as PlayerRow[]) {
    playerCounts.set(
      player.reservation_id,
      (playerCounts.get(player.reservation_id) ?? 0) + 1
    );
  }

  const fullCourtIds = new Set<number>();
  for (const reservation of reservations) {
    if ((playerCounts.get(reservation.id) ?? 0) >= PLAYERS_PER_FULL_COURT) {
      fullCourtIds.add(reservation.court_id);
    }
  }

  return fullCourtIds.size >= FULL_COURTS_REQUIRED;
}

function buildAllCourtsFullEmailHtml(params: {
  date: string;
  slotStart: string;
  slotEnd: string;
  messageText: string;
  openUrl: string;
}) {
  const { date, slotStart, slotEnd, messageText, openUrl } = params;
  const dayLabel = formatSpanishWeekdayDay(date);
  const schedule = `${toHM(slotStart)} - ${toHM(slotEnd)}`;

  const detailsHtml = `
    ${matchInfoRow("Dia", dayLabel)}
    ${matchInfoRow("Horario", schedule)}
    ${matchInfoRow("Estado", "3 pistas completas")}
  `;

  const extraHtml = `
    <div style="margin-top: 20px;">
      <a href="${escapeHtml(openUrl)}" style="display: inline-block; background: #0f5e2e; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 700; font-size: 14px;">
        Copiar y abrir WhatsApp
      </a>
    </div>

    <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      <div style="font-size: 13px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 10px;">
        Texto para WhatsApp
      </div>
      <pre style="white-space: pre-wrap; word-break: break-word; background: #fcfcfd; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; font-family: monospace; font-size: 13px; margin: 0; color: #111827; line-height: 1.5;">
${escapeHtml(messageText)}
      </pre>
    </div>
  `;

  return emailShell({
    preheader: "Un horario completo se ha llenado en las 3 pistas.",
    title: "Horario completo",
    intro: `Ya estan completas las 3 pistas para <strong>${escapeHtml(
      dayLabel
    )}</strong> a las <strong>${escapeHtml(toHM(slotStart))}</strong>.`,
    badge: "3 pistas completas",
    matchDetailsHtml: detailsHtml,
    extraHtml,
    footer:
      "El boton abre una pagina segura para copiar el aviso y lanzar WhatsApp.",
    clubName: CLUB_NAME,
  });
}

async function markAlertFailed(alertId: string, error: unknown) {
  const updateRes = await supabaseAdmin
    .from("all_courts_full_alerts")
    .update({
      status: "failed",
      error_message: getErrorMessage(error).slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", alertId);

  if (updateRes.error) {
    console.error(
      "Error marcando aviso de horario completo como fallido:",
      updateRes.error.message
    );
  }
}

export async function maybeSendAllCourtsFullAlert(params: {
  date: string;
  slotStart: string;
  slotEnd: string;
}) {
  const { date, slotStart, slotEnd } = params;

  const isFull = await hasThreeFullCourts({ date, slotStart, slotEnd });
  if (!isFull) {
    return { sent: false, reason: "not_full" };
  }

  const to = getDailySummaryRecipients();
  if (to.length === 0) {
    throw new Error("Falta configurar DAILY_SUMMARY_TO.");
  }

  const resend = getResendClient();
  if (!resend || !process.env.EMAIL_FROM) {
    throw new Error("Falta configurar RESEND_API_KEY o EMAIL_FROM.");
  }

  const token = crypto.randomUUID().replaceAll("-", "");
  const messageText = buildAllCourtsFullWhatsappMessage({
    date,
    slotStart,
  });

  const insertRes = await supabaseAdmin
    .from("all_courts_full_alerts")
    .insert({
      token,
      date,
      slot_start: slotStart,
      slot_end: slotEnd,
      message_text: messageText,
      recipients: to,
      status: "pending",
    })
    .select("id,token")
    .single();

  if (insertRes.error) {
    if (isUniqueViolation(insertRes.error)) {
      return { sent: false, reason: "already_sent" };
    }

    throw new Error(
      `Error guardando aviso de horario completo: ${insertRes.error.message}`
    );
  }

  const alert = insertRes.data as AlertInsertRow;
  const openUrl = `${getAppUrl()}/admin/whatsapp-summary/${alert.token}`;
  const subject = `Horario completo · ${formatEmailSubjectSchedule(
    date,
    slotStart
  )}`;
  const html = buildAllCourtsFullEmailHtml({
    date,
    slotStart,
    slotEnd,
    messageText,
    openUrl,
  });

  try {
    const { error, data } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });

    if (error) {
      throw new Error(
        typeof error === "string" ? error : JSON.stringify(error)
      );
    }

    const resendEmailId =
      data && typeof data.id === "string" ? data.id : null;

    const updateRes = await supabaseAdmin
      .from("all_courts_full_alerts")
      .update({
        status: "sent",
        resend_email_id: resendEmailId,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", alert.id);

    if (updateRes.error) {
      console.error(
        "Error marcando aviso de horario completo como enviado:",
        updateRes.error.message
      );
    }

    return { sent: true, token: alert.token, openUrl };
  } catch (error) {
    await markAlertFailed(alert.id, error);
    throw error;
  }
}
