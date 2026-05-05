type ReservationWhatsappPlayer = {
  name: string;
};

type ReservationWhatsappMessageParams = {
  date: string;
  slotStart: string;
  slotEnd: string;
  players: ReservationWhatsappPlayer[];
};

const WEEKDAYS_ES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function capitalize(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function toHM(value: string) {
  return value?.length >= 5 ? value.slice(0, 5) : value;
}

function parseISODateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

export function buildReservationWhatsappMessage({
  date,
  slotStart,
  slotEnd,
  players,
}: ReservationWhatsappMessageParams) {
  const { year, month, day } = parseISODateParts(date);
  const safeDate = new Date(year, month - 1, day, 12);
  const weekday = capitalize(WEEKDAYS_ES[safeDate.getDay()] ?? "");
  const monthName = MONTHS_ES[month - 1] ?? "";
  const playerLines = Array.from({ length: 4 }, (_, index) => {
    const playerName = players[index]?.name?.trim();
    return playerName ? `🎾 ${playerName}` : "🎾";
  });

  return [
    `*${weekday} ${day} de ${monthName} ${toHM(slotStart)} a ${toHM(slotEnd)}*`,
    ...playerLines,
  ].join("\n");
}
