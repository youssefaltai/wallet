/** Get today's date as YYYY-MM-DD */
export function getCurrentDate(): string {
  const now = new Date();
  return formatISODate(now);
}

/** Navigate by `delta` days from a YYYY-MM-DD string */
export function navigateDay(date: string, delta: number): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + delta);
  return formatISODate(d);
}

/** Format a YYYY-MM-DD string for short display, e.g. "Mar 29, 2026" */
export function formatDateShort(date: string): string {
  const d = parseLocalDate(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Parse YYYY-MM-DD to a local Date (avoids timezone issues with new Date(string)) */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date object as YYYY-MM-DD */
export function formatISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Get start and end dates of the month containing the given date */
export function getMonthRange(date: string): { startDate: string; endDate: string } {
  const d = parseLocalDate(date);
  const y = d.getFullYear();
  const m = d.getMonth();
  const startDate = formatISODate(new Date(y, m, 1));
  const endDate = formatISODate(new Date(y, m + 1, 0));
  return { startDate, endDate };
}

/** Get month key (YYYY-MM) from a YYYY-MM-DD date */
export function getMonthKey(date: string): string {
  return date.substring(0, 7);
}
