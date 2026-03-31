/**
 * Human-friendly date and datetime formatting.
 *
 * formatDate(dateString)       — for YYYY-MM-DD date strings (budgets, goals)
 * formatRelativeDateTime(iso)  — for ISO timestamps, shows "1 minute ago", "3 hours ago", etc.
 * formatDateTime(iso)          — for ISO timestamps, date-level relative (no time-level granularity)
 */

function parseLocal(dateString: string): Date {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
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
 * Format an ISO datetime string into a relative, human-friendly label.
 *
 * - "Just now" (< 1 min ago)
 * - "2 minutes ago" (< 1 hour)
 * - "3 hours ago" (< 24 hours, today)
 * - "Yesterday at 2:30 PM"
 * - "Monday at 2:30 PM" (within last week)
 * - "Mar 29 at 2:30 PM" (same year)
 * - "Mar 29, 2025 at 2:30 PM" (different year)
 */
export function formatRelativeDateTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);

  const today = startOfDay(now);
  const dateDay = startOfDay(date);
  const diffDays = Math.round(
    (today.getTime() - dateDay.getTime()) / 86_400_000
  );

  // Future dates or very recent
  if (diffMs < 0) {
    // Future — just show the date + time
    return formatDateWithTime(date, now);
  }

  // Less than 1 minute ago
  if (diffSec < 60) return "Just now";

  // Less than 1 hour ago
  if (diffMin < 60) {
    return diffMin === 1 ? "1 minute ago" : `${diffMin} minutes ago`;
  }

  // Today, more than 1 hour ago
  if (diffDays === 0) {
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  }

  // Yesterday
  if (diffDays === 1) return `Yesterday at ${formatTime(date)}`;

  // Within the last week
  if (diffDays >= 2 && diffDays <= 6) {
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    return `${weekday} at ${formatTime(date)}`;
  }

  return formatDateWithTime(date, now);
}

function formatDateWithTime(date: Date, reference: Date): string {
  const time = formatTime(date);
  const sameYear = date.getFullYear() === reference.getFullYear();
  if (sameYear) {
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${dateStr} at ${time}`;
  }
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${dateStr} at ${time}`;
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
