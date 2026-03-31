import { tool } from "ai";
import * as z from "zod";
import { updateUserProfile } from "@/lib/services/users";
import { CURRENCY_CODES } from "@/lib/constants/currencies";

export function createSettingsTools(userId: string) {
  return {
    update_currency: tool({
      description:
        "Update the user's base currency. This changes the default currency used for all financial displays and new transactions.",
      inputSchema: z.object({
        currency: z
          .string()
          .length(3)
          .transform((v) => v.toUpperCase())
          .describe(
            `ISO 4217 currency code, e.g. "USD", "EUR", "GBP". Supported: ${CURRENCY_CODES.join(", ")}`,
          ),
      }),
      execute: async ({ currency }) => {
        if (!CURRENCY_CODES.includes(currency)) {
          return {
            success: false,
            error: `Unsupported currency "${currency}". Supported currencies: ${CURRENCY_CODES.join(", ")}`,
          };
        }
        try {
          await updateUserProfile(userId, { currency });
          return { success: true, currency };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),
  };
}
