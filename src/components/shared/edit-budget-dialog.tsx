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
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { updateBudgetAction, getBudgetDateRangesAction } from "@/app/(app)/actions";
import type { BudgetStatus, BudgetDateRange } from "@/lib/services/budgets";
import { makeDateDisabler } from "@/components/shared/budget-date-utils";

export function EditBudgetDialog({
  open,
  onOpenChange,
  budget,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetStatus | null;
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [existingRanges, setExistingRanges] = useState<BudgetDateRange[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { showError, ErrorDialog } = useErrorDialog();

  useEffect(() => {
    if (open && budget) {
      setStartDate(budget.startDate);
      setEndDate(budget.endDate);
      getBudgetDateRangesAction(budget.categoryAccountId, budget.id).then((result) => {
        if (result.data) setExistingRanges(result.data);
      });
    }
  }, [open, budget]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Budget</DialogTitle>
        </DialogHeader>
        {budget && (
          <form
            action={async (formData) => {
              setSubmitting(true);
              formData.set("startDate", startDate);
              formData.set("endDate", endDate);
              const result = await updateBudgetAction(formData);
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
            <input type="hidden" name="budgetId" value={budget.id} />
            <div className="space-y-2">
              <Label htmlFor="edit-cat-budget-name">Budget Name</Label>
              <Input
                id="edit-cat-budget-name"
                name="name"
                defaultValue={budget.name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cat-budget-amount">Amount</Label>
              <MoneyInput
                id="edit-cat-budget-amount"
                name="amount"
                defaultValue={budget.budgetAmount.toFixed(2)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-cat-budget-start">Start Date</Label>
                <DatePicker
                  id="edit-cat-budget-start"
                  name="startDate"
                  value={startDate}
                  onChange={setStartDate}
                  required
                  isDisabled={makeDateDisabler(existingRanges, "start", endDate)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cat-budget-end">End Date</Label>
                <DatePicker
                  id="edit-cat-budget-end"
                  name="endDate"
                  value={endDate}
                  onChange={setEndDate}
                  required
                  isDisabled={makeDateDisabler(existingRanges, "end", startDate)}
                />
              </div>
            </div>
            {existingRanges.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Dates within other budget periods are unavailable.
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !startDate || !endDate}
            >
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        )}
      </DialogContent>
      <ErrorDialog />
    </Dialog>
  );
}
