import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { CLUB_NAME } from "@/lib/brand";
import { emailShell, escapeHtml, matchInfoRow, EMAIL_COLORS } from "@/lib/email-templates";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

type ReservationRow = {
  id: string;
  date: string;
  slot_start: string;
  slot_end: string;
  court_id: number;
  status?: string | null;
};

type PlayerRow = {
  reservation_id: string;
  seat: number;
  member_user_id: string;
};

type MemberRow = {
  user_id: string;
  full_name: string;
  alias?: string | null;
  email?: string | null;
  is_active?: boolean;
};

type CourtRow = {
  id: number;
  name: string;
};

type OpenMatch = {
  slotStart: string;
  slotEnd: string;
  courtName: string;
  players: string[];
  missing: number;
};

type ClosedMatch = {
  reservationId: string;
  slotStart: string;
  slotEnd: string;
  courtName: string;
  players: string[];
  playerDetails: Array<{
    userId: string;
    name: string;
  }>;
};

function esc(s: string) {
  return escapeHtml(s);
}

function toISODateLocal(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toISODateLocal(d);
}

function isSundayISO(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00`);
  return d.getDay() === 0;
}

function formatDateLongES(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00`);
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

function toHM(t: string) {
  return t?.length >= 5 ? t.slice(0, 5) : t;
}

function nameFirstSurname(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${parts[1]}`;
}

function getMemberDisplayName(member: Pick<MemberRow, "alias" | "full_name">) {
  const alias = member.alias?.trim();
  if (alias) return alias;

  const fullName = member.full_name?.trim();
  if (fullName) return fullName;

  return "Socio";
}

function parseEmailList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function renderReminderPlayers(players: string[]) {
  if (!players || players.length === 0) return "";

  return `
    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      <div style="font-size: 13px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 10px;">
        Integrantes
      </div>
      <div style="display: grid; gap: 8px;">
        ${players
          .map(
            (player) => `
              <div style="display: flex; align-items: center; gap: 8px; font-size: 15px; color: #111827;">
                <span style="color: #0f5e2e; font-weight: 600;">•</span>
                <span>${esc(player)}</span>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function buildWhatsappMessage(params: {
  targetDate: string;
  openMatches: OpenMatch[];
  closedMatches: ClosedMatch[];
}) {
  const { targetDate, openMatches, closedMatches } = params;

  const lines: string[] = [];
  lines.push(`🎾 Partidas de mañana - ${capitalize(formatDateLongES(targetDate))}`);
  lines.push("");

  lines.push("🟢 ABIERTAS");
  lines.push("");

  if (openMatches.length === 0) {
    lines.push("No hay partidas abiertas");
  } else {
    for (const match of openMatches) {
      lines.push(`${match.slotStart}-${match.slotEnd} · ${match.courtName}`);

      for (const player of match.players) {
        lines.push(`🎾 ${player}`);
      }

      if (match.missing > 0) {
        const txt = match.missing === 1 ? "falta 1" : `faltan ${match.missing}`;
        lines.push(`➕ ${txt}`);
      }

      lines.push("");
    }
  }

  lines.push("");
  lines.push("🔒 CERRADAS");
  lines.push("");

  if (closedMatches.length === 0) {
    lines.push("No hay partidas cerradas");
  } else {
    for (const match of closedMatches) {
      lines.push(`${match.slotStart}-${match.slotEnd} · ${match.courtName}`);

      for (const player of match.players) {
        lines.push(`🎾 ${player}`);
      }

      lines.push("");
    }
  }

  return lines.join("\n");
}

function buildEmailHtml(params: {
  targetDate: string;
  messageText: string;
  openCount: number;
  closedCount: number;
  openUrl: string;
}) {
  const { targetDate, messageText, openCount, closedCount, openUrl } = params;

  const detailsHtml = `
    ${matchInfoRow("Abiertas", String(openCount))}
    ${matchInfoRow("Cerradas", String(closedCount))}
  `;

  const extraHtml = `
    <div style="margin-top: 20px;">
      <a href="${esc(openUrl)}" style="display: inline-block; background: #0f5e2e; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 700; font-size: 14px;">
        Abrir para copiar
      </a>
    </div>

    <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      <div style="font-size: 13px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 10px;">
        Vista previa
      </div>
      <pre style="white-space: pre-wrap; word-break: break-word; background: #fcfcfd; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; font-family: monospace; font-size: 13px; margin: 0; color: #111827; line-height: 1.5;">
${esc(messageText)}
      </pre>
    </div>
  `;

  return emailShell({
    preheader: "Aquí tienes el resumen diario del club.",
    title: "Resumen de partidas",
    intro: `Resumen de partidas para <strong>${esc(capitalize(formatDateLongES(targetDate)))}</strong>.`,
    badge: `${openCount} abiertas · ${closedCount} cerradas`,
    matchDetailsHtml: detailsHtml,
    extraHtml,
    footer: "Puedes copiar el mensaje y enviarlo por WhatsApp. 🎾",
    clubName: CLUB_NAME,
  });
}

function buildReminderEmailHtml(params: {
  fullName: string;
  targetDate: string;
  slotStart: string;
  slotEnd: string;
  courtName: string;
  players: string[];
}) {
  const { fullName, targetDate, slotStart, slotEnd, courtName, players } = params;

  const detailsHtml = `
    ${matchInfoRow("Fecha", capitalize(formatDateLongES(targetDate)))}
    ${matchInfoRow("Horario", `${slotStart} - ${slotEnd}`)}
    ${matchInfoRow("Pista", courtName)}
  `;

  const extraHtml = renderReminderPlayers(players);

  return emailShell({
    preheader: "Te recordamos tu partida de mañana en el club.",
    title: "Recordatorio de partida",
    badge: "Mañana",
    intro: `Hola ${esc(fullName)}. Te recordamos que mañana tienes una partida cerrada en el club.`,
    matchDetailsHtml: detailsHtml,
    extraHtml,
    footer: "Nos vemos en la pista. 🎾",
    clubName: CLUB_NAME,
  });
}

function isAuthorized(req: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return true;

  const auth = req.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

async function sendClosedMatchReminders(params: {
  targetDate: string;
  closedMatches: ClosedMatch[];
}) {
  const { targetDate, closedMatches } = params;

  let remindersSent = 0;
  let remindersSkipped = 0;

  for (const match of closedMatches) {
    for (const player of match.playerDetails) {
      const existingLogRes = await supabase
        .from("match_reminder_logs")
        .select("id")
        .eq("reservation_id", match.reservationId)
        .eq("member_user_id", player.userId)
        .eq("reminder_type", "day_before_closed_match")
        .eq("sent_for_date", targetDate)
        .maybeSingle();

      if (existingLogRes.error) {
        throw new Error(
          `Error comprobando log de recordatorio: ${existingLogRes.error.message}`
        );
      }

      if (existingLogRes.data) {
        remindersSkipped++;
        continue;
      }

      const memberRes = await supabase
        .from("members")
        .select("user_id,full_name,alias,email")
        .eq("user_id", player.userId)
        .single();

      if (memberRes.error) {
        throw new Error(
          `Error cargando socio para recordatorio: ${memberRes.error.message}`
        );
      }

      const member = memberRes.data as MemberRow | null;
      if (!member?.email) {
        remindersSkipped++;
        continue;
      }

      const subject = `Recordatorio de partida mañana - ${capitalize(
        formatDateLongES(targetDate)
      )}`;

      const html = buildReminderEmailHtml({
        fullName: nameFirstSurname(member.full_name),
        targetDate,
        slotStart: match.slotStart,
        slotEnd: match.slotEnd,
        courtName: match.courtName,
        players: match.players,
      });

      const { error: reminderEmailError } = await resend.emails.send({
        from: process.env.EMAIL_FROM as string,
        to: member.email,
        subject,
        html,
      });

      if (reminderEmailError) {
        throw new Error(
          typeof reminderEmailError === "string"
            ? reminderEmailError
            : JSON.stringify(reminderEmailError)
        );
      }

      const insertLogRes = await supabase.from("match_reminder_logs").insert({
        reservation_id: match.reservationId,
        member_user_id: player.userId,
        reminder_type: "day_before_closed_match",
        sent_for_date: targetDate,
      });

      if (insertLogRes.error) {
        throw new Error(
          `Error guardando log de recordatorio: ${insertLogRes.error.message}`
        );
      }

      remindersSent++;
    }
  }

  return {
    remindersSent,
    remindersSkipped,
  };
}

async function runDailySummary() {
  const targetDate = tomorrowISO();

  if (isSundayISO(targetDate)) {
    return {
      ok: true,
      skipped: true,
      targetDate,
      reason: "sunday",
    };
  }

  const reservationsRes = await supabase
    .from("reservations")
    .select("id,date,slot_start,slot_end,court_id,status")
    .eq("date", targetDate)
    .eq("status", "active")
    .order("slot_start", { ascending: true })
    .order("court_id", { ascending: true });

  if (reservationsRes.error) {
    throw new Error(`Error cargando reservas: ${reservationsRes.error.message}`);
  }

  const reservations = (reservationsRes.data ?? []) as ReservationRow[];

  const reservationIds = reservations.map((r) => r.id);

  let players: PlayerRow[] = [];
  if (reservationIds.length > 0) {
    const playersRes = await supabase
      .from("reservation_players")
      .select("reservation_id,seat,member_user_id")
      .in("reservation_id", reservationIds);

    if (playersRes.error) {
      throw new Error(`Error cargando jugadores: ${playersRes.error.message}`);
    }

    players = (playersRes.data ?? []) as PlayerRow[];
  }

  const userIds = Array.from(new Set(players.map((p) => p.member_user_id)));

  const membersMap = new Map<string, string>();
  if (userIds.length > 0) {
    const membersRes = await supabase
      .from("members")
      .select("user_id,full_name,alias,email,is_active")
      .in("user_id", userIds);

    if (membersRes.error) {
      throw new Error(`Error cargando socios: ${membersRes.error.message}`);
    }

    for (const row of (membersRes.data ?? []) as MemberRow[]) {
      membersMap.set(row.user_id, getMemberDisplayName(row));
    }
  }

  const courtsRes = await supabase.from("courts").select("id,name");
  if (courtsRes.error) {
    throw new Error(`Error cargando pistas: ${courtsRes.error.message}`);
  }

  const courtsMap = new Map<number, string>();
  for (const row of (courtsRes.data ?? []) as CourtRow[]) {
    courtsMap.set(row.id, row.name);
  }

  const playersByReservation = new Map<
    string,
    Array<{ seat: number; userId: string; name: string }>
  >();

  for (const p of players) {
    const arr = playersByReservation.get(p.reservation_id) ?? [];
    arr.push({
      seat: p.seat,
      userId: p.member_user_id,
      name: membersMap.get(p.member_user_id) ?? "Socio",
    });
    playersByReservation.set(p.reservation_id, arr);
  }

  for (const [key, arr] of playersByReservation.entries()) {
    arr.sort((a, b) => a.seat - b.seat);
    playersByReservation.set(key, arr);
  }

  const openMatches: OpenMatch[] = [];
  const closedMatches: ClosedMatch[] = [];

  for (const reservation of reservations) {
    const arr = playersByReservation.get(reservation.id) ?? [];
    const names = arr.map((x) => x.name);
    const count = arr.length;
    const courtName =
      courtsMap.get(reservation.court_id) ?? `Pista ${reservation.court_id}`;

    if (count >= 4) {
      closedMatches.push({
        reservationId: reservation.id,
        slotStart: toHM(reservation.slot_start),
        slotEnd: toHM(reservation.slot_end),
        courtName,
        players: names,
        playerDetails: arr.map((x) => ({
          userId: x.userId,
          name: x.name,
        })),
      });
    } else {
      openMatches.push({
        slotStart: toHM(reservation.slot_start),
        slotEnd: toHM(reservation.slot_end),
        courtName,
        players: names.length > 0 ? names : ["Sin jugadores"],
        missing: Math.max(0, 4 - count),
      });
    }
  }

  const messageText = buildWhatsappMessage({
    targetDate,
    openMatches,
    closedMatches,
  });

  const reminderResult = await sendClosedMatchReminders({
    targetDate,
    closedMatches,
  });

  const token = crypto.randomUUID().replaceAll("-", "");

  const insertSummary = await supabase
    .from("daily_whatsapp_summaries")
    .insert({
      token,
      target_date: targetDate,
      message_text: messageText,
    })
    .select("token")
    .single();

  if (insertSummary.error) {
    throw new Error(
      `Error guardando resumen diario: ${insertSummary.error.message}`
    );
  }

  const appUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const openUrl = `${appUrl}/admin/whatsapp-summary/${token}`;

  const to = parseEmailList(process.env.DAILY_SUMMARY_TO);
  if (to.length === 0) {
    throw new Error("Falta configurar DAILY_SUMMARY_TO");
  }

  const subject = `Resumen de partidas - ${capitalize(
    formatDateLongES(targetDate)
  )}`;

  const html = buildEmailHtml({
    targetDate,
    messageText,
    openCount: openMatches.length,
    closedCount: closedMatches.length,
    openUrl,
  });

  const { error: emailError, data: emailData } = await resend.emails.send({
    from: process.env.EMAIL_FROM as string,
    to,
    subject,
    html,
  });

  if (emailError) {
    throw new Error(
      typeof emailError === "string"
        ? emailError
        : JSON.stringify(emailError)
    );
  }

  return {
    ok: true,
    targetDate,
    openCount: openMatches.length,
    closedCount: closedMatches.length,
    token,
    openUrl,
    emailData,
    remindersSent: reminderResult.remindersSent,
    remindersSkipped: reminderResult.remindersSkipped,
  };
}

export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const result = await runDailySummary();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error inesperado",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const result = await runDailySummary();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error inesperado",
      },
      { status: 500 }
    );
  }
}
