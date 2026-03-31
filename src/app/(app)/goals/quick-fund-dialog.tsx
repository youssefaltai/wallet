"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProgressBar } from "@/components/ui/progress-bar";
import { fundGoalAction } from "../actions";
import type { GoalWithProgress } from "@/lib/services/goals";
import type { AccountWithBalance } from "@/lib/services/accounts";

interface QuickFundDialogProps {
  goal: GoalWithProgress;
  accounts: AccountWithBalance[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickFundDialog({
  goal,
  accounts,
  open,
  onOpenChange,
}: QuickFundDialogProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id ?? ""
  );
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  const parsedAmount = parseFloat(amount);
  const isValid =
    selectedAccountId && amount && !isNaN(parsedAmount) && parsedAmount > 0 && date;

  const fmtCurrency = useCallback(
    (n: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: goal.currency,
      }).format(n),
    [goal.currency],
  );

  const previewText =
    isValid && selectedAccount
      ? `Move ${fmtCurrency(parsedAmount)} from ${selectedAccount.name} \u2192 ${goal.name}`
      : null;

  function resetState() {
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setTime(() => {
      const now = new Date();
      return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    });
    setError(null);
    setSuccess(false);
    setSubmitting(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetState();
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set("goalId", goal.id);
    formData.set("sourceAccountId", selectedAccountId);
    formData.set("amount", parsedAmount.toString());
    formData.set("date", new Date(`${date}T${time}`).toISOString());

    const result = await fundGoalAction(formData);

    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
    // Auto-close after short delay so user sees the success state
    setTimeout(() => handleOpenChange(false), 800);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fund {goal.name}</DialogTitle>
        </DialogHeader>

        {/* Goal progress summary */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">{goal.currentAmountFormatted}</span>
            <span className="text-muted-foreground">
              of {goal.targetAmountFormatted}
            </span>
          </div>
          <ProgressBar
            value={goal.progressPercent}
            className="overflow-hidden"
            barClassName="bg-primary transition-all"
          />
          <p className="text-xs text-muted-foreground text-right">
            {goal.progressPercent}% funded
          </p>
        </div>

        {success ? (
          <div className="py-4 text-center text-sm font-medium text-primary">
            Funded successfully!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account selector */}
            <div className="space-y-2">
              <Label htmlFor="fund-account">Fund from</Label>
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No accounts available. Create an account first.
                </p>
              ) : (
                <Select
                  value={selectedAccountId}
                  onValueChange={(value) => {
                    if (value !== null) setSelectedAccountId(value);
                  }}
                  items={accounts.map((a) => ({
                    value: a.id,
                    label: `${a.name} (${a.balanceFormatted})`,
                  }))}
                >
                  <SelectTrigger id="fund-account" className="w-full">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.balanceFormatted})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Amount input */}
            <div className="space-y-2">
              <Label htmlFor="fund-amount">Amount</Label>
              <MoneyInput
                id="fund-amount"
                name="amount"
                currencyCode={goal.currency}
                placeholder="0.00"
                value={amount}
                onChange={setAmount}
                required
              />
            </div>

            {/* Date & time input */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fund-date">Date</Label>
                <DatePicker
                  id="fund-date"
                  value={date}
                  onChange={setDate}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fund-time">Time</Label>
                <TimePicker
                  id="fund-time"
                  value={time}
                  onChange={setTime}
                  required
                />
              </div>
            </div>

            {/* Preview */}
            {previewText && (
              <p className="text-sm text-muted-foreground rounded-md bg-muted px-3 py-2">
                {previewText}
              </p>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isValid || submitting || accounts.length === 0}
              >
                {submitting ? "Funding..." : "Fund"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
