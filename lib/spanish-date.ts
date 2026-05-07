export function toHM(value: string) {
  return value?.length >= 5 ? value.slice(0, 5) : value;
}

export function capitalizeSpanish(value: string) {
  return value
    ? value.charAt(0).toLocaleUpperCase("es-ES") + value.slice(1)
    : value;
}

export function formatSpanishWeekdayDay(dateISO: string) {
  const date = new Date(`${dateISO}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateISO;
  }

  const weekday = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
  }).format(date);

  return `${capitalizeSpanish(weekday)} ${date.getDate()}`;
}
