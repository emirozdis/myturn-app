const OFFSET_PATTERN = /^(?:UTC)?([+-])(\d{1,2})(?::?(\d{2}))?$/i;

export function parseUtcOffset(value: string | null | undefined): number {
  if (!value || value.toUpperCase() === "UTC" || value === "Z") return 0;
  const match = value.trim().match(OFFSET_PATTERN);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
  return match[1] === "-" ? -minutes : minutes;
}

export function formatUtcOffset(offsetMinutes: number): string {
  if (offsetMinutes === 0) return "UTC";
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

export function getDeviceUtcOffset(date = new Date()): string {
  return formatUtcOffset(-date.getTimezoneOffset());
}

export function getBusinessClock(date = new Date(), timezone = "UTC") {
  const shifted = new Date(date.getTime() + parseUtcOffset(timezone) * 60_000);
  return {
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(), second: shifted.getUTCSeconds(), shifted,
  };
}

export function getBusinessHour(date = new Date(), timezone = "UTC"): number {
  return getBusinessClock(date, timezone).hour;
}

export function formatBusinessDate(date: Date, timezone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(getBusinessClock(date, timezone).shifted);
}
