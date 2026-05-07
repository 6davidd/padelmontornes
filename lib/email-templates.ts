/**
 * Sistema de plantillas de email unificado
 * Diseño limpio, minimalista y mobile-first
 * Compatible con clientes de email reales
 */

// ============================================================================
// COLORES Y CONSTANTES
// ============================================================================

export const EMAIL_COLORS = {
  CLUB_GREEN: "#0f5e2e",
  CLUB_GREEN_DARK: "#0b4723",
  SOFT_BG: "#f6f7f8",
  CARD_BG: "#ffffff",
  BORDER: "#e5e7eb",
  TEXT: "#111827",
  MUTED: "#6b7280",
  SUCCESS_BG: "#ecfdf5",
  SUCCESS_BORDER: "#bbf7d0",
  SUCCESS_TEXT: "#166534",
};

// ============================================================================
// UTILIDADES
// ============================================================================

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatEmailSubjectDate(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00`);

  if (Number.isNaN(d.getTime())) {
    return dateISO;
  }

  const weekday = new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
  })
    .format(d)
    .replace(/\.$/, "");
  const weekdayTitle =
    weekday.charAt(0).toLocaleUpperCase("es-ES") + weekday.slice(1);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");

  return `${weekdayTitle} ${day}/${month}`;
}

export function formatEmailSubjectSchedule(
  dateISO: string,
  slotStart: string
): string {
  const start = slotStart?.length >= 5 ? slotStart.slice(0, 5) : slotStart;
  return `${formatEmailSubjectDate(dateISO)} · ${start}`;
}

/**
 * Renderiza una fila de información dentro de la tarjeta de partida
 * Mantiene consistencia visual en toda la app
 */
export function matchInfoRow(label: string, value: string): string {
  const { MUTED, TEXT } = EMAIL_COLORS;
  return `
    <tr>
      <td style="padding: 10px 0; color: ${MUTED}; font-size: 14px; vertical-align: top; width: 92px;">
        ${escapeHtml(label)}
      </td>
      <td style="padding: 10px 0; color: ${TEXT}; font-size: 15px; font-weight: 600;">
        ${escapeHtml(value)}
      </td>
    </tr>
  `;
}

/**
 * Renderiza los jugadores de la partida en estilo compact
 * Similar a cómo la app los muestra
 */
export function renderMatchPlayers(
  players: string[] = [],
  label: string = "Jugadores"
): string {
  if (!players || players.length === 0) return "";

  const { TEXT, MUTED } = EMAIL_COLORS;
  return `
    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      <div style="font-size: 13px; font-weight: 700; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 10px;">
        ${escapeHtml(label)}
      </div>
      <div style="display: grid; gap: 8px;">
        ${players
          .map(
            (player) => `
              <div style="display: flex; align-items: center; gap: 8px; font-size: 15px; color: ${TEXT};">
                <span style="color: #0f5e2e; font-weight: 600;">•</span>
                <span>${escapeHtml(player)}</span>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

/**
 * Renderiza un badge de estado/información
 */
export function emailBadge(text: string, variant: "success" | "info" = "success"): string {
  const styles =
    variant === "success"
      ? {
          bg: EMAIL_COLORS.SUCCESS_BG,
          border: EMAIL_COLORS.SUCCESS_BORDER,
          color: EMAIL_COLORS.SUCCESS_TEXT,
        }
      : {
          bg: "#f0f9ff",
          border: "#bfdbfe",
          color: "#1e40af",
        };

  return `
    <span style="
      display: inline-block;
      padding: 6px 12px;
      border-radius: 999px;
      background: ${styles.bg};
      border: 1px solid ${styles.border};
      color: ${styles.color};
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.2px;
    ">
      ${escapeHtml(text)}
    </span>
  `;
}

// ============================================================================
// PLANTILLA PRINCIPAL DE EMAIL
// ============================================================================

export interface EmailShellParams {
  preheader: string;
  title: string;
  intro: string;
  badge?: string;
  badgeVariant?: "success" | "info";
  matchDetailsHtml?: string;
  extraHtml?: string;
  footer?: string;
  clubName: string;
}

/**
 * Plantilla base de email: limpia, minimalista, mobile-first
 * Estructura:
 * - Preheader
 * - Header con nombre del club
 * - Tarjeta principal con cabecera verde
 * - Título y badge
 * - Intro/mensaje
 * - Bloque de detalles de la partida (si aplica)
 * - Sección extra
 * - Footer con call-to-action suave
 */
export function emailShell(params: EmailShellParams): string {
  const {
    preheader,
    title,
    intro,
    badge,
    badgeVariant = "success",
    matchDetailsHtml = "",
    extraHtml = "",
    footer,
    clubName,
  } = params;

  const { SOFT_BG, CARD_BG, CLUB_GREEN, BORDER, TEXT, MUTED, CLUB_GREEN_DARK } = EMAIL_COLORS;

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="margin: 0; padding: 0; background: ${SOFT_BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: ${TEXT};">
        <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
          ${escapeHtml(preheader)}
        </div>

        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background: ${SOFT_BG}; padding: 20px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="max-width: 580px;">
                <!-- Club branding header -->
                <tr>
                  <td style="padding: 0 0 16px; text-align: center;">
                    <div style="font-size: 13px; font-weight: 700; color: ${CLUB_GREEN_DARK}; letter-spacing: 0.3px;">
                      🎾 ${escapeHtml(clubName)}
                    </div>
                  </td>
                </tr>

                <!-- Main card -->
                <tr>
                  <td style="background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 20px; overflow: hidden;">
                    <!-- Green header with title -->
                    <div style="background: ${CLUB_GREEN}; padding: 20px 20px 16px;">
                      <div style="font-size: 26px; line-height: 1.3; font-weight: 800; color: #ffffff;">
                        ${escapeHtml(title)}
                      </div>
                    </div>

                    <!-- Content area -->
                    <div style="padding: 20px;">
                      <!-- Badge -->
                      ${badge ? `<div style="margin-bottom: 14px;">${emailBadge(badge, badgeVariant)}</div>` : ""}

                      <!-- Intro text -->
                      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: ${TEXT};">
                        ${intro}
                      </p>

                      <!-- Match details block (if present) -->
                      ${
                        matchDetailsHtml
                          ? `
                        <div style="border: 1px solid ${BORDER}; border-radius: 16px; padding: 16px; background: #fcfcfd; margin-bottom: 16px;">
                          <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
                            ${matchDetailsHtml}
                          </table>
                        </div>
                      `
                          : ""
                      }

                      <!-- Extra content -->
                      ${extraHtml}

                      <!-- Footer message -->
                      ${
                        footer
                          ? `
                        <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid ${BORDER}; font-size: 13px; line-height: 1.6; color: ${MUTED};">
                          ${footer}
                        </div>
                      `
                          : ""
                      }
                    </div>
                  </td>
                </tr>

                <!-- Footer branding -->
                <tr>
                  <td style="padding-top: 12px; text-align: center; font-size: 11px; color: ${MUTED}; letter-spacing: 0.2px;">
                    ${escapeHtml(clubName)}
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

// ============================================================================
// HELPERS PARA INFORMACIÓN DE PARTIDA
// ============================================================================

/**
 * Formatea la información de una partida para mostrar en el email
 * Similar a cómo la app lo muestra
 */
export function formatMatchInfo(params: {
  date: string;
  slotStart: string;
  slotEnd: string;
  courtName: string;
  playersCount?: number;
}): string {
  const schedule = `${params.slotStart} - ${params.slotEnd}`;
  return [
    matchInfoRow("Fecha", params.date),
    matchInfoRow("Horario", schedule),
    matchInfoRow("Pista", params.courtName),
    params.playersCount ? matchInfoRow("Jugadores", `${params.playersCount}/4`) : "",
  ]
    .filter(Boolean)
    .join("");
}

/**
 * Información compacta de partida para resumen
 */
export function compactMatchInfo(params: { slotStart: string; courtName: string }): string {
  return matchInfoRow("Detalles", `${params.slotStart} • ${params.courtName}`);
}
