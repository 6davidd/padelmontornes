import { getClientSession } from "@/lib/client-session";

export type ClientReservationActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function leaveReservationRequest(
  reservationId: string
): Promise<ClientReservationActionResult> {
  const session = await getClientSession();

  if (!session?.access_token) {
    return { ok: false, error: "No hay sesión." };
  }

  const response = await fetch("/api/reservations/leave", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ reservationId }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.ok) {
    return {
      ok: false,
      error: String(data?.error ?? "No se ha podido salir de la reserva."),
    };
  }

  return { ok: true };
}
