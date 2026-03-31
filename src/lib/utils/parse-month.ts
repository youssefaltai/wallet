import { getCurrentDate, getMonthRange, getMonthKey } from "./date";

const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Parse a date param (YYYY-MM-DD) or legacy month param (YYYY-MM) into
 * a month date range. Falls back to current date if invalid.
 */
export function parseMonthParam(param?: string): {
  startDate: string;
  endDate: string;
  monthKey: string;
} {
  let dateKey: string;

  if (param && DATE_REGEX.test(param)) {
    dateKey = param;
  } else if (param && MONTH_REGEX.test(param)) {
    // Legacy month format — treat as first of that month
    dateKey = `${param}-01`;
  } else {
    dateKey = getCurrentDate();
  }

  const { startDate, endDate } = getMonthRange(dateKey);
  const monthKey = getMonthKey(dateKey);
  return { startDate, endDate, monthKey };
}
