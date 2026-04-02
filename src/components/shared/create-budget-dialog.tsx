"use client";

import { useState, useEffect } from "react";
import { useErrorDialog } from "@/hooks/use-error-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { createBudgetAction, getBudgetDateRangesAction } from "@/app/(app)/actions";
import type { CategoryWithTotal } from "@/lib/services/categories";
import type { BudgetDateRange } from "@/lib/services/budgets";
import { makeDateDisabler } from "@/components/shared/budget-date-utils";

export function CreateBudgetDialog({
  open,
  onOpenChange,
  category,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryWithTotal | null;
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [existingRanges, setExistingRanges] = useState<BudgetDateRange[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { showError, ErrorDialog } = useErrorDialog();

  useEffect(() => {
    if (open && category) {
      getBudgetDateRangesAction(category.id).then((result) => {
        setStartDate("");
        setEndDate("");
        if (result.data) setExistingRanges(result.data);
      });
    }
  }, [open, category]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Budget for {category?.name}</DialogTitle>
        </DialogHeader>
        {category && (
          <form
            action={async (formData) => {
              setSubmitting(true);
              formData.set("name", category.name);
              formData.set("categoryAccountId", category.id);
              formData.set("startDate", startDate);
              formData.set("endDate", endDate);
              const result = await createBudgetAction(formData);
              setSubmitting(false);
              if (result?.error) {
                showError(result.error);
                return;
              }
              onOpenChange(false);
              onSuccess();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="budget-amount">Budget Amount</Label>
              <MoneyInput
                id="budget-amount"
                name="amount"
                placeholder="500.00"
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget-start">Start Date</Label>
                <DatePicker
                  id="budget-start"
                  name="startDate"
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Start"
                  required
                  isDisabled={makeDateDisabler(existingRanges, "start", endDate)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget-end">End Date</Label>
                <DatePicker
                  id="budget-end"
                  name="endDate"
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="End"
                  required
                  isDisabled={makeDateDisabler(existingRanges, "end", startDate)}
                />
              </div>
            </div>
            {existingRanges.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Dates within existing budget periods are unavailable.
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !startDate || !endDate}
            >
              {submitting ? "Creating..." : "Create Budget"}
            </Button>
          </form>
        )}
      </DialogContent>
      <ErrorDialog />
    </Dialog>
  );
}
