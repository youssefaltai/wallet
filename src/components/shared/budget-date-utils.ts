import type { BudgetDateRange } from "@/lib/services/budgets";

/**
 * Given sorted existing budget ranges, a selected start date, and a selected end date,
 * compute which dates should be disabled for start and end pickers.
 */
export function makeDateDisabler(
  ranges: BudgetDateRange[],
  pickerRole: "start" | "end",
  otherDate: string
): (date: string) => boolean {
  return (date: string) => {
    // A date that falls inside any existing budget range is always disabled
    for (const r of ranges) {
      if (date >= r.startDate && date <= r.endDate) return true;
    }

    if (pickerRole === "start" && otherDate) {
      // Start date cannot be after the selected end date
      if (date > otherDate) return true;
      // Start date cannot be before the end date such that an existing range
      // sits between them (would create an overlap)
      for (const r of ranges) {
        if (r.startDate > date && r.startDate <= otherDate) return true;
      }
    }

    if (pickerRole === "end" && otherDate) {
      // End date cannot be before the selected start date
      if (date < otherDate) return true;
      // End date cannot be after the start date such that an existing range
      // sits between them
      for (const r of ranges) {
        if (r.endDate >= otherDate && r.endDate < date) return true;
        if (r.startDate > otherDate && r.startDate <= date) return true;
      }
    }

    return false;
  };
}
