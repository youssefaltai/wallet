"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import type { CrossCurrencyState } from "@/hooks/use-cross-currency";

interface CrossCurrencyFieldsProps {
  state: CrossCurrencyState;
  sourceCurrency: string;
  destCurrency: string;
  /** HTML id prefix for the fields (e.g. "pay" → "pay-amount") */
  idPrefix: string;
}

export function CrossCurrencyFields({
  state,
  sourceCurrency,
  destCurrency,
  idPrefix,
}: CrossCurrencyFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-amount`}>
          Amount ({sourceCurrency})
        </Label>
        <MoneyInput
          id={`${idPrefix}-amount`}
          name="amount"
          placeholder="0.00"
          value={state.amount}
          onChange={state.handleAmountChange}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-credit-amount`}>
          Amount ({destCurrency})
        </Label>
        <MoneyInput
          id={`${idPrefix}-credit-amount`}
          name="creditAmount"
          placeholder="0.00"
          value={state.creditAmount}
          onChange={state.handleCreditAmountChange}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-exchange-rate`}>
          Rate ({sourceCurrency} → {destCurrency})
        </Label>
        <Input
          id={`${idPrefix}-exchange-rate`}
          name="exchangeRate"
          type="number"
          step="any"
          min="0"
          placeholder="e.g. 1.08"
          value={state.exchangeRate}
          onChange={state.handleExchangeRateChange}
        />
      </div>
    </>
  );
}
