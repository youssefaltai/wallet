import * as z from "zod";
import { parseAmount } from "@/lib/services/money";

/** Accepts a raw number or any formatted amount string (e.g. "1,234.56", "EGP 1,234.56"). Must be positive. */
export const moneyInput = z
  .union([z.number(), z.string().min(1)])
  .transform((v): number => {
    const n = typeof v === "number" ? v : parseAmount(v);
    if (n <= 0) throw new Error("Amount must be greater than 0");
    return n;
  });

/** Like moneyInput but allows zero (for opening balances). */
export const balanceMoney = z
  .union([z.number(), z.string().min(1)])
  .transform((v): number => {
    const n = typeof v === "number" ? v : parseAmount(v);
    if (n < 0) throw new Error("Balance must be 0 or greater");
    return n;
  });
