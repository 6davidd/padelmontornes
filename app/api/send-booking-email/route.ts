import { Resend } from "resend";

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

const CLUB_GREEN = "#0f5e2e";
const CLUB_GREEN_DARK = "#0b4723";
const SOFT_BG = "#f6f7f8";
const CARD_BG = "#ffffff";
const BORDER = "#e5e7eb";
const TEXT = "#111827";
const MUTED = "#6b7280";

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function infoRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding: 10px 0; color: ${MUTED}; font-size: 14px; vertical-align: top; width: 92px;">
        ${esc(label)}
      </td>
      <td style="padding: 10px 0; color: ${TEXT}; font-size: 15px; font-weight: 600;">
        ${esc(value)}
      </td>
    </tr>
  `;
}

function renderPlayersChips(players?: string[]) {
  if (!players || players.length === 0) return "";

  return `
    <div style="margin-top: 18px;">
      <div style="font-size: 14px; font-weight: 700; color: ${TEXT}; margin-bottom: 10px;">
        Jugadores
      </div>
      <div>
        ${players
          .map(
            (player) => `
              <span style="
                display: inline-block;
                margin: 0 8px 8px 0;
                padding: 8px 12px;
                border-radius: 999px;
                background: #f3f4f6;
                border: 1px solid #e5e7eb;
                color: ${TEXT};
                font-size: 14px;
              ">
                ${esc(player)}
              </span>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function emailShell(params: {
  preheader: string;
  title: string;
  intro: string;
  badge?: string;
  detailsHtml: string;
  extraHtml?: string;
  footer?: string;
}) {
  const { preheader, title, intro, badge, detailsHtml, extraHtml = "", footer } = params;

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${esc(title)}</title>
      </head>
      <body style="margin: 0; padding: 0; background: ${SOFT_BG}; font-family: Arial, Helvetica, sans-serif; color: ${TEXT};">
        <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
          ${esc(preheader)}
        </div>

        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background: ${SOFT_BG}; padding: 24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="max-width: 620px;">
                <tr>
                  <td style="padding-bottom: 14px; text-align: center;">
                    <div style="font-size: 14px; font-weight: 700; color: ${CLUB_GREEN_DARK}; letter-spacing: 0.2px;">
                      🎾 Club Pádel Montornès
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 24px; overflow: hidden;">
                    <div style="background: ${CLUB_GREEN}; padding: 22px 24px;">
                      <div style="margin-top: 8px; font-size: 28px; line-height: 1.2; font-weight: 800; color: #ffffff;">
                        ${esc(title)}
                      </div>
                    </div>

                    <div style="padding: 24px;">
                      ${
                        badge
                          ? `
                            <div style="margin-bottom: 16px;">
                              <span style="
                                display: inline-block;
                                padding: 8px 12px;
                                border-radius: 999px;
                                background: #ecfdf5;
                                border: 1px solid #bbf7d0;
                                color: #166534;
                                font-size: 13px;
                                font-weight: 700;
                              ">
                                ${esc(badge)}
                              </span>
                            </div>
                          `
                          : ""
                      }

                      <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.6; color: ${TEXT};">
                        ${intro}
                      </p>

                      <div style="border: 1px solid ${BORDER}; border-radius: 18px; padding: 18px 18px 10px; background: #fcfcfd;">
                        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
                          ${detailsHtml}
                        </table>
                      </div>

                      ${extraHtml}

                      <div style="margin-top: 22px; font-size: 13px; line-height: 1.6; color: ${MUTED};">
                        ${footer ?? "Nos vemos en la pista. 🎾"}
                      </div>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 14px; text-align: center; font-size: 12px; color: ${MUTED};">
                    Club Pádel Montornès
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

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

    const helloName = fullName ? `, ${esc(fullName)}` : "";
    const schedule = `${slotStart} - ${slotEnd}`;

    let subject = "";
    let html = "";

    if (type === "booking_created") {
      subject = `🎾 Reserva confirmada · ${courtName} · ${slotStart}`;
      html = emailShell({
        preheader: "Tu reserva ha sido confirmada correctamente.",
        title: "Reserva confirmada 🎾",
        badge: "Todo listo",
        intro: `Hola${helloName}. Tu reserva ya está confirmada y guardada en el club.`,
        detailsHtml: `
          ${infoRow("Fecha", date)}
          ${infoRow("Horario", schedule)}
          ${infoRow("Pista", courtName)}
        `,
        footer: "Si se apunta más gente, la partida irá cogiendo forma. ¡A disfrutar! 🎾",
      });
    }

    if (type === "added_to_match") {
      subject = addedByName
        ? `🎾 ${addedByName} te ha añadido a una partida`
        : "🎾 Te han añadido a una partida";

      html = emailShell({
        preheader: "Te han añadido a una partida del club.",
        title: "Te han añadido a una partida 🎾",
        badge: "Nueva partida",
        intro: addedByName
          ? `Hola${helloName}. <strong>${esc(addedByName)}</strong> te ha añadido a una partida.`
          : `Hola${helloName}. Se te ha añadido a una partida del club.`,
        detailsHtml: `
          ${infoRow("Fecha", date)}
          ${infoRow("Horario", schedule)}
          ${infoRow("Pista", courtName)}
        `,
        footer: "Revisa la app cuando quieras para ver cómo va quedando la partida.",
      });
    }

    if (type === "admin_opened_match") {
      subject = openedByName
        ? `🎾 ${openedByName} ha abierto una partida para ti`
        : `🎾 Han abierto una partida para ti`;

      html = emailShell({
        preheader: "Han abierto una partida para ti en el club.",
        title: "Han abierto una partida para ti 🎾",
        badge: `${players.length || 1}/4 jugadores`,
        intro: openedByName
          ? `Hola${helloName}. <strong>${esc(openedByName)}</strong> ha abierto una partida para ti.`
          : `Hola${helloName}. Han abierto una partida para ti en el club.`,
        detailsHtml: `
          ${infoRow("Fecha", date)}
          ${infoRow("Horario", schedule)}
          ${infoRow("Pista", courtName)}
        `,
        extraHtml: renderPlayersChips(players),
        footer: "Ya puedes entrar en la app para verla y seguir cómo va quedando la partida.",
      });
    }

    if (type === "match_completed") {
      subject = `🎾 Partida completa · ${courtName} · ${slotStart}`;
      html = emailShell({
        preheader: "La partida ya está completa.",
        title: "Partida completa 🎾",
        badge: `${playersCount ?? 4}/4 jugadores`,
        intro: `Hola${helloName}. La partida ya está cerrada y completa.`,
        detailsHtml: `
          ${infoRow("Fecha", date)}
          ${infoRow("Horario", schedule)}
          ${infoRow("Pista", courtName)}
        `,
        extraHtml: renderPlayersChips(players),
        footer: "Ya estáis los 4. ¡Buen partido y a disfrutar de la pista! 🎾",
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