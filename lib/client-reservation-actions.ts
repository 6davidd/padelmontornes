import { getClientSession } from "@/lib/client-session";

export type ClientReservationActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type RemoveReservationPlayerResult =
  | {
      ok: true;
      reservationId: string;
      removedMemberUserId: string;
      playersCount: number;
      reservationStatus: "active" | "cancelled" | string;
    }
  | { ok: false; error: string };

export type AddReservationPlayerResult =
  | { ok: true; seat: number }
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

export async function removeReservationPlayerRequest({
  reservationId,
  memberUserId,
}: {
  reservationId: string;
  memberUserId: string;
}): Promise<RemoveReservationPlayerResult> {
  const session = await getClientSession();

  if (!session?.access_token) {
    return { ok: false, error: "No hay sesión." };
  }

  const response = await fetch("/api/admin/reservations/remove-player", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ reservationId, memberUserId }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.ok) {
    return {
      ok: false,
      error: String(data?.error ?? "No se ha podido quitar el jugador."),
    };
  }

  return {
    ok: true,
    reservationId: String(data.reservationId),
    removedMemberUserId: String(data.removedMemberUserId),
    playersCount: Number(data.playersCount ?? 0),
    reservationStatus: String(data.reservationStatus ?? "active"),
  };
}

export async function addReservationPlayerRequest({
  reservationId,
  memberUserId,
}: {
  reservationId: string;
  memberUserId: string;
}): Promise<AddReservationPlayerResult> {
  const session = await getClientSession();

  if (!session?.access_token) {
    return { ok: false, error: "No hay sesión." };
  }

  const response = await fetch("/api/reservations/join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ reservationId, memberUserId }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.ok) {
    return {
      ok: false,
      error: String(data?.error ?? "No se ha podido añadir el socio."),
    };
  }

  return {
    ok: true,
    seat: Number(data.seat ?? 0),
  };
}
