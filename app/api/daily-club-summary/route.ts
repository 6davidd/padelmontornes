import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

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
  email?: string | null;
  is_active?: boolean;
};

type CourtRow = {
  id: number;
  name: string;
};

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function buildWhatsappMessage(params: {
  targetDate: string;
  openMatches: Array<{
    slotStart: string;
    slotEnd: string;
    courtName: string;
    players: string[];
    missing: number;
  }>;
  closedMatches: Array<{
    slotStart: string;
    slotEnd: string;
    courtName: string;
    players: string[];
  }>;
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

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function buildEmailHtml(params: {
  targetDate: string;
  messageText: string;
  openCount: number;
  closedCount: number;
  openUrl: string;
}) {
  const { targetDate, messageText, openCount, closedCount, openUrl } = params;

  return `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.45;">
      <h2 style="margin: 0 0 12px;">Resumen diario del club</h2>

      <p style="margin: 0 0 12px;">
        Aquí tienes el resumen de partidas de
        <strong>${esc(capitalize(formatDateLongES(targetDate)))}</strong>.
      </p>

      <ul style="margin: 0 0 16px; padding-left: 18px;">
        <li><strong>Partidas abiertas:</strong> ${openCount}</li>
        <li><strong>Partidas cerradas:</strong> ${closedCount}</li>
      </ul>

      <div style="margin: 20px 0;">
        <a
          href="${esc(openUrl)}"
          style="
            display: inline-block;
            background: #0f5e2e;
            color: #ffffff;
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 999px;
            font-weight: 700;
          "
        >
          Abrir para copiar
        </a>
      </div>

      <p style="margin: 0 0 8px; font-weight: 700;">Vista previa del mensaje:</p>

      <pre style="
        white-space: pre-wrap;
        word-break: break-word;
        background: #f6f7f8;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        padding: 16px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        margin: 0;
      ">${esc(messageText)}</pre>
    </div>
  `;
}

function isAuthorized(req: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return true;

  const auth = req.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

async function runDailySummary() {
  const targetDate = tomorrowISO();

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
      .select("user_id,full_name,email,is_active")
      .in("user_id", userIds);

    if (membersRes.error) {
      throw new Error(`Error cargando socios: ${membersRes.error.message}`);
    }

    for (const row of (membersRes.data ?? []) as MemberRow[]) {
      membersMap.set(row.user_id, nameFirstSurname(row.full_name));
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

  const openMatches: Array<{
    slotStart: string;
    slotEnd: string;
    courtName: string;
    players: string[];
    missing: number;
  }> = [];

  const closedMatches: Array<{
    slotStart: string;
    slotEnd: string;
    courtName: string;
    players: string[];
  }> = [];

  for (const reservation of reservations) {
    const arr = playersByReservation.get(reservation.id) ?? [];
    const names = arr.map((x) => x.name);
    const count = arr.length;
    const courtName =
      courtsMap.get(reservation.court_id) ?? `Pista ${reservation.court_id}`;

    if (count >= 4) {
      closedMatches.push({
        slotStart: toHM(reservation.slot_start),
        slotEnd: toHM(reservation.slot_end),
        courtName,
        players: names,
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

  const to = process.env.DAILY_SUMMARY_TO;
  if (!to) {
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