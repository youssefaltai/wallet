"use client";

import { createContext, useContext } from "react";

const CurrencyContext = createContext<string>("USD");

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: string;
  children: React.ReactNode;
}) {
  return (
    <CurrencyContext value={currency}>
      {children}
    </CurrencyContext>
  );
}

export function useCurrency(): string {
  return useContext(CurrencyContext);
}
