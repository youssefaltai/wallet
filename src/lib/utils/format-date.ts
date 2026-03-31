/**
 * Human-friendly date formatting.
 *
 * - "Today", "Yesterday", "Tomorrow" for adjacent dates
 * - "Monday", "Tuesday" etc. for dates within the last/next 7 days
 * - "Mar 29" for dates within the current year
 * - "Mar 29, 2025" for dates in a different year
 *
 * All inputs are YYYY-MM-DD strings (local dates, no timezone shift).
 */

function parseLocal(dateString: string): Date {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Format a YYYY-MM-DD date string into a human-friendly label.
 *
 * @param dateString  A date in YYYY-MM-DD format
 * @param opts.relative  Whether to use relative labels like "Today" / "Yesterday" (default true)
 */
export function formatDate(
  dateString: string,
  opts?: { relative?: boolean }
): string {
  const relative = opts?.relative ?? true;
  const date = parseLocal(dateString);
  const today = startOfDay(new Date());
  const diffDays = Math.round(
    (today.getTime() - startOfDay(date).getTime()) / 86_400_000
  );

  if (relative) {
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays === -1) return "Tomorrow";
    if (diffDays >= 2 && diffDays <= 6) {
      return date.toLocaleDateString("en-US", { weekday: "long" });
    }
    if (diffDays >= -6 && diffDays <= -2) {
      return date.toLocaleDateString("en-US", { weekday: "long" });
    }
  }

  const sameYear = date.getFullYear() === today.getFullYear();
  if (sameYear) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a YYYY-MM-DD date into a full readable date (no relative labels).
 * e.g. "March 29, 2026"
 */
export function formatDateFull(dateString: string): string {
  const date = parseLocal(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a date range into a human-friendly string.
 * e.g. "Mar 1 – Mar 31" or "Mar 1 – Mar 31, 2025"
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = parseLocal(startDate);
  const end = parseLocal(endDate);
  const today = new Date();
  const sameYear =
    start.getFullYear() === end.getFullYear() &&
    end.getFullYear() === today.getFullYear();

  if (sameYear) {
    const startStr = start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endStr = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${startStr} \u2013 ${endStr}`;
  }

  const startStr = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const endStr = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startStr} \u2013 ${endStr}`;
}

/**
 * Format an ISO datetime string (from DB timestamps like updatedAt/createdAt)
 * into a human-friendly label.
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const today = startOfDay(new Date());
  const dateDay = startOfDay(date);
  const diffDays = Math.round(
    (today.getTime() - dateDay.getTime()) / 86_400_000
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays === -1) return "Tomorrow";
  if (diffDays >= 2 && diffDays <= 6) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }
  if (diffDays >= -6 && diffDays <= -2) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }

  const sameYear = date.getFullYear() === today.getFullYear();
  if (sameYear) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
