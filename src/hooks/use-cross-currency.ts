"use client";

import { useState, useRef, useCallback, useLayoutEffect } from "react";
import { getDecimalPlaces } from "@/lib/constants/currencies";

type Field = "amount" | "creditAmount" | "exchangeRate";

export interface CrossCurrencyState {
  amount: string;
  creditAmount: string;
  exchangeRate: string;
  handleAmountChange: (val: string) => void;
  handleCreditAmountChange: (val: string) => void;
  handleExchangeRateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  reset: () => void;
  /** Parsed values ready for form submission. Returns undefined for invalid/empty fields. */
  parsed: {
    creditAmount: number | undefined;
    exchangeRate: number | undefined;
  };
}

export function useCrossCurrency(
  isCrossCurrency: boolean,
  debitCurrency = "USD",
  creditCurrency = "USD",
): CrossCurrencyState {
  const [amount, setAmount] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");

  // Refs to hold latest values so handlers avoid stale closures (Bug #8)
  const amountRef = useRef(amount);
  const creditAmountRef = useRef(creditAmount);
  const exchangeRateRef = useRef(exchangeRate);

  // Keep refs in sync with state (useLayoutEffect runs after render but before paint,
  // so handlers always see fresh values without causing "ref access during render")
  useLayoutEffect(() => {
    amountRef.current = amount;
    creditAmountRef.current = creditAmount;
    exchangeRateRef.current = exchangeRate;
  });

  const debitDecimals = getDecimalPlaces(debitCurrency);
  const creditDecimals = getDecimalPlaces(creditCurrency);

  const syncFields = useCallback(
    (
      field: Field,
      newAmount: string,
      newCreditAmount: string,
      newExchangeRate: string,
    ) => {
      const a = parseFloat(newAmount);
      const c = parseFloat(newCreditAmount);
      const r = parseFloat(newExchangeRate);

      if (field === "amount") {
        if (!isNaN(a) && a > 0 && !isNaN(r) && r > 0) {
          setCreditAmount((a * r).toFixed(creditDecimals));
        } else if (!isNaN(a) && a > 0 && !isNaN(c) && c > 0) {
          setExchangeRate((c / a).toFixed(6).replace(/0+$/, "").replace(/\.$/, ""));
        }
      } else if (field === "creditAmount") {
        if (!isNaN(c) && c > 0 && !isNaN(r) && r > 0) {
          setAmount((c / r).toFixed(debitDecimals));
        } else if (!isNaN(c) && c > 0 && !isNaN(a) && a > 0) {
          setExchangeRate((c / a).toFixed(6).replace(/0+$/, "").replace(/\.$/, ""));
        }
      } else if (field === "exchangeRate") {
        if (!isNaN(r) && r > 0 && !isNaN(a) && a > 0) {
          setCreditAmount((a * r).toFixed(creditDecimals));
        } else if (!isNaN(r) && r > 0 && !isNaN(c) && c > 0) {
          setAmount((c / r).toFixed(debitDecimals));
        }
      }
    },
    [debitDecimals, creditDecimals],
  );

  const handleAmountChange = useCallback(
    (val: string) => {
      setAmount(val);
      if (isCrossCurrency)
        syncFields("amount", val, creditAmountRef.current, exchangeRateRef.current);
    },
    [isCrossCurrency, syncFields],
  );

  const handleCreditAmountChange = useCallback(
    (val: string) => {
      setCreditAmount(val);
      if (isCrossCurrency)
        syncFields("creditAmount", amountRef.current, val, exchangeRateRef.current);
    },
    [isCrossCurrency, syncFields],
  );

  const handleExchangeRateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setExchangeRate(val);
      if (isCrossCurrency)
        syncFields("exchangeRate", amountRef.current, creditAmountRef.current, val);
    },
    [isCrossCurrency, syncFields],
  );

  const reset = useCallback(() => {
    setAmount("");
    setCreditAmount("");
    setExchangeRate("");
  }, []);

  const parsedCredit = parseFloat(creditAmount);
  const parsedRate = parseFloat(exchangeRate);

  return {
    amount,
    creditAmount,
    exchangeRate,
    handleAmountChange,
    handleCreditAmountChange,
    handleExchangeRateChange,
    reset,
    parsed: {
      creditAmount: !isNaN(parsedCredit) && parsedCredit > 0 ? parsedCredit : undefined,
      exchangeRate: !isNaN(parsedRate) && parsedRate > 0 ? parsedRate : undefined,
    },
  };
}
