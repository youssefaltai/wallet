"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { createTransferAction } from "@/app/(app)/actions";
import { useCrossCurrency } from "@/hooks/use-cross-currency";
import { CrossCurrencyFields } from "@/components/shared/cross-currency-fields";
import type { AccountWithBalance } from "@/lib/services/accounts";

interface QuickPayDialogProps {
  /** The liability account being paid off */
  account: AccountWithBalance;
  /** Asset accounts the user can pay from */
  sourceAccounts: AccountWithBalance[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickPayDialog({
  account,
  sourceAccounts,
  open,
  onOpenChange,
}: QuickPayDialogProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    sourceAccounts[0]?.id ?? ""
  );
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedSource = useMemo(
    () => sourceAccounts.find((a) => a.id === selectedAccountId),
    [sourceAccounts, selectedAccountId]
  );

  const isCrossCurrency =
    selectedSource != null && selectedSource.currency !== account.currency;
  const sourceCurrency = selectedSource?.currency ?? "USD";
  const destCurrency = account.currency;

  const fx = useCrossCurrency(isCrossCurrency);

  const parsedAmount = parseFloat(fx.amount);
  const isValid =
    selectedAccountId && fx.amount && !isNaN(parsedAmount) && parsedAmount > 0 && date;

  const previewText =
    isValid && selectedSource
      ? `Pay ${new Intl.NumberFormat("en-US", { style: "currency", currency: sourceCurrency }).format(parsedAmount)} from ${selectedSource.name} → ${account.name}`
      : null;

  function resetState() {
    fx.reset();
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
    formData.set("fromAccountId", selectedAccountId);
    formData.set("toAccountId", account.id);
    formData.set("amount", parsedAmount.toString());
    formData.set("description", `Payment: ${account.name}`);
    formData.set("date", new Date(`${date}T${time}`).toISOString());

    if (isCrossCurrency) {
      if (fx.parsed.creditAmount !== undefined) {
        formData.set("creditAmount", fx.parsed.creditAmount.toString());
      }
      if (fx.parsed.exchangeRate !== undefined) {
        formData.set("exchangeRate", fx.parsed.exchangeRate.toString());
      }
    }

    const result = await createTransferAction(formData);

    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
    setTimeout(() => handleOpenChange(false), 800);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay Off {account.name}</DialogTitle>
        </DialogHeader>

        {/* Balance summary */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Outstanding balance</span>
            <span className="font-medium">{account.balanceFormatted}</span>
          </div>
        </div>

        {success ? (
          <div className="py-4 text-center text-sm font-medium text-primary">
            Payment recorded!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Source account selector */}
            <div className="space-y-2">
              <Label htmlFor="pay-account">Pay from</Label>
              {sourceAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No accounts available. Create a bank account first.
                </p>
              ) : (
                <Select
                  value={selectedAccountId}
                  onValueChange={(value) => {
                    if (value !== null) {
                      setSelectedAccountId(value);
                      fx.reset();
                    }
                  }}
                  items={sourceAccounts.map((a) => ({
                    value: a.id,
                    label: `${a.name} (${a.balanceFormatted})`,
                  }))}
                >
                  <SelectTrigger id="pay-account" className="w-full">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({a.balanceFormatted})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Amount fields */}
            {isCrossCurrency ? (
              <CrossCurrencyFields
                state={fx}
                sourceCurrency={sourceCurrency}
                destCurrency={destCurrency}
                idPrefix="pay"
              />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="pay-amount">Amount</Label>
                <MoneyInput
                  id="pay-amount"
                  name="amount"
                  placeholder="0.00"
                  value={fx.amount}
                  onChange={fx.handleAmountChange}
                  required
                />
              </div>
            )}

            {/* Date & time input */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pay-date">Date</Label>
                <DatePicker
                  id="pay-date"
                  value={date}
                  onChange={setDate}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-time">Time</Label>
                <TimePicker
                  id="pay-time"
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
                disabled={!isValid || submitting || sourceAccounts.length === 0}
              >
                {submitting ? "Paying..." : "Pay"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
