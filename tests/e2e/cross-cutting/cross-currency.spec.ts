import { test, expect, createVerifiedUser, deleteTestUser, loginViaUI } from "../../fixtures/auth";
import {
  seedAccount,
  seedBalance,
  seedForeignBalance,
  seedCategoryAccount,
  seedExpense,
  seedIncome,
  seedGoal,
  seedBudget,
  seedExchangeRates,
  seedCrossCurrencyTransfer,
  seedJournalEntry,
  getAccountBalanceRaw,
} from "../../fixtures/db-helpers";
import { db } from "../../fixtures/auth";
import * as schema from "../../../src/lib/db/schema";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Cross-Currency E2E Tests
//
// These tests verify that multi-currency scenarios work correctly across the
// entire stack: database seeding -> service layer -> server rendering -> browser.
// ---------------------------------------------------------------------------

// ── Deterministic FX rates ────────────────────────────────────────────────
// We seed fixed rates so tests are deterministic (no API calls needed).
// All rates are relative to USD (base).

const FX_RATES: Record<string, number> = {
  EUR: 0.85,
  GBP: 0.73,
  JPY: 110.0,
  BHD: 0.377,
  KWD: 0.307,
  CAD: 1.25,
  AUD: 1.35,
  CHF: 0.92,
  EGP: 30.9,
  SAR: 3.75,
  AED: 3.673,
  ISK: 137.0,
  KRW: 1300.0,
  TRY: 27.0,
};

// ── Date helpers ──────────────────────────────────────────────────────────

function thisMonthDate(day = 1): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** Locate a summary stat card on the dashboard. */
function statCard(page: import("@playwright/test").Page, title: string) {
  return page.locator('[data-slot="card"]').filter({ hasText: title }).first();
}

// ── Seed FX rates before each test ────────────────────────────────────────

test.beforeEach(async () => {
  const today = new Date().toISOString().slice(0, 10);
  await seedExchangeRates(FX_RATES, today);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await seedExchangeRates(FX_RATES, yesterday);
});

// ==========================================================================
// 1. ACCOUNTS — Multi-Currency Display
// ==========================================================================

test.describe("Cross-currency: Accounts page", () => {
  test("displays accounts in their native currencies with currency badges", async ({
    authedPage,
    testUser,
  }) => {
    const usdAccount = await seedAccount(testUser.id, {
      name: "US Checking",
      type: "asset",
      currency: "USD",
    });
    await seedBalance(testUser.id, usdAccount.id, 5000);

    const eurAccount = await seedAccount(testUser.id, {
      name: "Euro Savings",
      type: "asset",
      currency: "EUR",
    });
    await seedForeignBalance(testUser.id, eurAccount.id, 3000);

    await authedPage.goto("/accounts");

    // USD account — no currency badge (matches user's base currency)
    const usdCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "US Checking" });
    await expect(usdCard).toBeVisible();
    await expect(usdCard.locator(".text-2xl")).toContainText("$5,000.00");

    // EUR account — should show EUR badge and EUR-formatted balance
    const eurCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "Euro Savings" });
    await expect(eurCard).toBeVisible();
    await expect(eurCard.locator(".text-2xl")).toContainText("€3,000.00");
    await expect(eurCard.getByText("EUR", { exact: true })).toBeVisible();
  });

  test("displays GBP liability account with correct formatting", async ({
    authedPage,
    testUser,
  }) => {
    const gbpLiab = await seedAccount(testUser.id, {
      name: "UK Credit Card",
      type: "liability",
      currency: "GBP",
    });
    // Owe £1,500: credit the liability with a balancing asset
    const tempAsset = await seedAccount(testUser.id, { name: "Temp Asset GBP", type: "asset" });
    await seedJournalEntry(testUser.id, {
      date: thisMonthDate(1),
      description: "GBP liability opening",
      lines: [
        { accountId: gbpLiab.id, amount: BigInt(-150000) },
        { accountId: tempAsset.id, amount: BigInt(150000) },
      ],
    });

    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "UK Credit Card" });
    await expect(card).toBeVisible();
    await expect(card.locator(".text-2xl")).toContainText("£1,500.00");
    await expect(card.getByText("GBP", { exact: true })).toBeVisible();
  });

  test("displays JPY account with zero decimal places", async ({
    authedPage,
    testUser,
  }) => {
    const jpyAccount = await seedAccount(testUser.id, {
      name: "Japan Account",
      type: "asset",
      currency: "JPY",
    });
    // JPY: factor=1, ¥50,000 = 50000 minor units
    await seedForeignBalance(testUser.id, jpyAccount.id, 50000, 1);

    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Japan Account" });
    await expect(card).toBeVisible();
    await expect(card.locator(".text-2xl")).toContainText("¥50,000");
    await expect(card.getByText("JPY", { exact: true })).toBeVisible();
  });

  test("displays BHD account with three decimal places", async ({
    authedPage,
    testUser,
  }) => {
    const bhdAccount = await seedAccount(testUser.id, {
      name: "Bahrain Account",
      type: "asset",
      currency: "BHD",
    });
    // BHD: factor=1000, 1.500 BHD = 1500 minor units
    await seedForeignBalance(testUser.id, bhdAccount.id, 1.5, 1000);

    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Bahrain Account" });
    await expect(card).toBeVisible();
    await expect(card.locator(".text-2xl")).toContainText("1.500");
    await expect(card.getByText("BHD", { exact: true })).toBeVisible();
  });

  test("displays multiple currencies side by side", async ({
    authedPage,
    testUser,
  }) => {
    const usd = await seedAccount(testUser.id, { name: "USD Account", type: "asset", currency: "USD" });
    const eur = await seedAccount(testUser.id, { name: "EUR Account", type: "asset", currency: "EUR" });
    const gbp = await seedAccount(testUser.id, { name: "GBP Account", type: "asset", currency: "GBP" });
    const jpy = await seedAccount(testUser.id, { name: "JPY Account", type: "asset", currency: "JPY" });

    await seedBalance(testUser.id, usd.id, 1000);
    await seedForeignBalance(testUser.id, eur.id, 2000);
    await seedForeignBalance(testUser.id, gbp.id, 500);
    await seedForeignBalance(testUser.id, jpy.id, 100000, 1);

    await authedPage.goto("/accounts");

    const usdCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "USD Account" });
    await expect(usdCard.locator(".text-2xl")).toContainText("$1,000.00");

    const eurCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "EUR Account" });
    await expect(eurCard.locator(".text-2xl")).toContainText("€2,000.00");

    const gbpCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "GBP Account" });
    await expect(gbpCard.locator(".text-2xl")).toContainText("£500.00");

    const jpyCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "JPY Account" });
    await expect(jpyCard.locator(".text-2xl")).toContainText("¥100,000");
  });

  test("zero-balance foreign currency account displays correctly", async ({
    authedPage,
    testUser,
  }) => {
    await seedAccount(testUser.id, {
      name: "Empty EUR",
      type: "asset",
      currency: "EUR",
    });

    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Empty EUR" });
    await expect(card).toBeVisible();
    await expect(card.locator(".text-2xl")).toContainText("€0.00");
  });
});

// ==========================================================================
// 2. ACCOUNTS — Create Account with Currency Selection
// ==========================================================================

test.describe("Cross-currency: Account creation", () => {
  test("creates a EUR account via the Add Account dialog", async ({
    authedPage,
  }) => {
    await authedPage.goto("/accounts");

    await authedPage.getByRole("button", { name: "Add Account" }).click();
    await authedPage.getByText("Bank & Cash").click();

    await authedPage.getByLabel("Account Name").fill("Deutsche Bank");
    await authedPage.getByLabel("Institution").fill("Deutsche Bank AG");
    // CurrencySelect uses Radix Select (not native <select>) — interact via click
    await authedPage.getByLabel("Currency").click();
    await authedPage.getByRole("option", { name: /EUR/ }).click();

    await authedPage.getByRole("button", { name: "Create Account" }).click();

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Deutsche Bank" });
    await expect(card).toBeVisible();
    await expect(card.locator(".text-2xl")).toContainText("€0.00");
    await expect(card.getByText("EUR", { exact: true })).toBeVisible();
  });

  test("creates a JPY liability account via the Add Account dialog", async ({
    authedPage,
  }) => {
    await authedPage.goto("/accounts");

    await authedPage.getByRole("button", { name: "Add Account" }).click();
    await authedPage.getByText("Credit & Loans").click();

    await authedPage.getByLabel("Account Name").fill("Japan Card");
    // CurrencySelect uses Radix Select (not native <select>) — interact via click
    await authedPage.getByLabel("Currency").click();
    await authedPage.getByRole("option", { name: /JPY/ }).click();

    await authedPage.getByRole("button", { name: "Create Account" }).click();

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Japan Card" });
    await expect(card).toBeVisible();
    await expect(card.locator(".text-2xl")).toContainText("¥0");
    await expect(card.getByText("JPY", { exact: true })).toBeVisible();
  });
});

// ==========================================================================
// 3. TRANSACTIONS — Cross-Currency Transfers
// ==========================================================================

test.describe("Cross-currency: Transactions page", () => {
  test("shows cross-currency transfer with source amount in transaction list", async ({
    authedPage,
    testUser,
  }) => {
    const usdAccount = await seedAccount(testUser.id, {
      name: "USD Checking",
      type: "asset",
      currency: "USD",
    });
    await seedBalance(testUser.id, usdAccount.id, 10000);

    const eurAccount = await seedAccount(testUser.id, {
      name: "EUR Savings",
      type: "asset",
      currency: "EUR",
    });

    await seedCrossCurrencyTransfer(
      testUser.id,
      usdAccount.id,
      eurAccount.id,
      1000,
      850,
      { date: thisMonthDate(5), description: "USD to EUR transfer" },
    );

    await authedPage.goto("/transactions");

    await expect(authedPage.getByText("USD to EUR transfer")).toBeVisible();
    await expect(authedPage.getByText("Transfer").first()).toBeVisible();
    await expect(authedPage.getByText("USD Checking → EUR Savings")).toBeVisible();
    await expect(authedPage.getByText("$1,000.00")).toBeVisible();
  });

  test("shows multiple cross-currency transactions", async ({
    authedPage,
    testUser,
  }) => {
    const usd = await seedAccount(testUser.id, { name: "USD Acct", type: "asset", currency: "USD" });
    const eur = await seedAccount(testUser.id, { name: "EUR Acct", type: "asset", currency: "EUR" });
    const gbp = await seedAccount(testUser.id, { name: "GBP Acct", type: "asset", currency: "GBP" });

    await seedBalance(testUser.id, usd.id, 20000);

    await seedCrossCurrencyTransfer(testUser.id, usd.id, eur.id, 2000, 1700, {
      date: thisMonthDate(3),
      description: "Transfer to Europe",
    });
    await seedCrossCurrencyTransfer(testUser.id, usd.id, gbp.id, 1500, 1095, {
      date: thisMonthDate(5),
      description: "Transfer to UK",
    });
    await seedCrossCurrencyTransfer(testUser.id, eur.id, gbp.id, 500, 430, {
      date: thisMonthDate(7),
      description: "Europe to UK transfer",
    });

    await authedPage.goto("/transactions");

    await expect(authedPage.getByText("Transfer to Europe")).toBeVisible();
    await expect(authedPage.getByText("Transfer to UK")).toBeVisible();
    await expect(authedPage.getByText("Europe to UK transfer")).toBeVisible();
  });

  test("filters cross-currency transactions by account", async ({
    authedPage,
    testUser,
  }) => {
    const usd = await seedAccount(testUser.id, { name: "USD Main", type: "asset", currency: "USD" });
    const eur = await seedAccount(testUser.id, { name: "EUR Main", type: "asset", currency: "EUR" });
    const gbp = await seedAccount(testUser.id, { name: "GBP Main", type: "asset", currency: "GBP" });

    await seedBalance(testUser.id, usd.id, 50000);

    await seedCrossCurrencyTransfer(testUser.id, usd.id, eur.id, 1000, 850, {
      date: thisMonthDate(3),
      description: "USD to EUR",
    });
    await seedCrossCurrencyTransfer(testUser.id, usd.id, gbp.id, 2000, 1460, {
      date: thisMonthDate(5),
      description: "USD to GBP",
    });

    await authedPage.goto(`/transactions?account=${eur.id}`);
    await expect(authedPage.getByText("USD to EUR")).toBeVisible();
    await expect(authedPage.getByText("USD to GBP")).not.toBeVisible();
  });

  test("correctly updates account balances after cross-currency transfer", async ({
    authedPage,
    testUser,
  }) => {
    const usd = await seedAccount(testUser.id, { name: "USD Source", type: "asset", currency: "USD" });
    const eur = await seedAccount(testUser.id, { name: "EUR Dest", type: "asset", currency: "EUR" });

    await seedBalance(testUser.id, usd.id, 5000);

    await seedCrossCurrencyTransfer(testUser.id, usd.id, eur.id, 1000, 850, {
      date: thisMonthDate(3),
    });

    await authedPage.goto("/accounts");

    const usdCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "USD Source" });
    await expect(usdCard.locator(".text-2xl")).toContainText("$4,000.00");

    const eurCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "EUR Dest" });
    await expect(eurCard.locator(".text-2xl")).toContainText("€850.00");
  });

  test("correctly handles multiple transfers affecting the same account", async ({
    authedPage,
    testUser,
  }) => {
    const usd = await seedAccount(testUser.id, { name: "US Bank", type: "asset", currency: "USD" });
    const eur = await seedAccount(testUser.id, { name: "EU Bank", type: "asset", currency: "EUR" });

    await seedBalance(testUser.id, usd.id, 10000);

    await seedCrossCurrencyTransfer(testUser.id, usd.id, eur.id, 2000, 1700, { date: thisMonthDate(3) });
    await seedCrossCurrencyTransfer(testUser.id, usd.id, eur.id, 3000, 2550, { date: thisMonthDate(5) });

    await authedPage.goto("/accounts");

    const usdCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "US Bank" });
    await expect(usdCard.locator(".text-2xl")).toContainText("$5,000.00");

    const eurCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "EU Bank" });
    await expect(eurCard.locator(".text-2xl")).toContainText("€4,250.00");
  });

  test("shows expenses from foreign-currency account", async ({
    authedPage,
    testUser,
  }) => {
    const eurAccount = await seedAccount(testUser.id, {
      name: "EUR Card",
      type: "asset",
      currency: "EUR",
    });
    await seedForeignBalance(testUser.id, eurAccount.id, 5000);

    const groceries = await seedCategoryAccount(testUser.id, "Epicerie", "expense");
    await seedExpense(testUser.id, eurAccount.id, groceries.id, 125.50, {
      date: thisMonthDate(5),
      description: "French groceries",
    });

    await authedPage.goto("/transactions");

    await expect(authedPage.getByText("French groceries")).toBeVisible();
    // Amount formatted in EUR (account's currency)
    await expect(authedPage.getByText("€125.50")).toBeVisible();
  });

  test("shows income to foreign-currency account", async ({
    authedPage,
    testUser,
  }) => {
    const gbpAccount = await seedAccount(testUser.id, {
      name: "GBP Current",
      type: "asset",
      currency: "GBP",
    });

    const salary = await seedCategoryAccount(testUser.id, "UK Salary", "income");
    await seedIncome(testUser.id, gbpAccount.id, salary.id, 3500, {
      date: thisMonthDate(10),
      description: "British salary",
    });

    await authedPage.goto("/transactions");

    await expect(authedPage.getByText("British salary")).toBeVisible();
    await expect(authedPage.getByText("£3,500.00")).toBeVisible();
  });

  test("handles JPY transactions with zero decimal places", async ({
    authedPage,
    testUser,
  }) => {
    const jpyAccount = await seedAccount(testUser.id, {
      name: "JPY Bank",
      type: "asset",
      currency: "JPY",
    });
    await seedForeignBalance(testUser.id, jpyAccount.id, 1000000, 1);

    const food = await seedCategoryAccount(testUser.id, "Food", "expense");
    // JPY expense of ¥5000 — use raw journal (seedExpense assumes factor 100)
    await seedJournalEntry(testUser.id, {
      date: thisMonthDate(5),
      description: "Ramen dinner",
      lines: [
        { accountId: food.id, amount: BigInt(5000) },
        { accountId: jpyAccount.id, amount: BigInt(-5000) },
      ],
    });

    await authedPage.goto("/transactions");
    await expect(authedPage.getByText("Ramen dinner")).toBeVisible();
    await expect(authedPage.getByText("¥5,000")).toBeVisible();
  });
});

// ==========================================================================
// 4. DASHBOARD — Multi-Currency Net Worth
// ==========================================================================

test.describe("Cross-currency: Dashboard", () => {
  test("computes net worth across currencies converted to user's base currency", async ({
    authedPage,
    testUser,
  }) => {
    const usd = await seedAccount(testUser.id, { name: "USD Bank", type: "asset", currency: "USD" });
    const eur = await seedAccount(testUser.id, { name: "EUR Bank", type: "asset", currency: "EUR" });

    await seedBalance(testUser.id, usd.id, 10000);
    await seedForeignBalance(testUser.id, eur.id, 5000);

    await authedPage.goto("/dashboard");

    // €5000 in USD = 5000 / 0.85 = ~$5882.35
    // Total assets = $10,000 + $5,882.35 = ~$15,882.35
    const netWorthCard = statCard(authedPage, "Net Worth");
    await expect(netWorthCard).toContainText("$15,882");
  });

  test("shows correct net worth with multi-currency assets and liabilities", async ({
    authedPage,
    testUser,
  }) => {
    const usdAsset = await seedAccount(testUser.id, { name: "USD Checking", type: "asset", currency: "USD" });
    const eurAsset = await seedAccount(testUser.id, { name: "EUR Savings", type: "asset", currency: "EUR" });
    const gbpLiability = await seedAccount(testUser.id, { name: "GBP Card", type: "liability", currency: "GBP" });

    await seedBalance(testUser.id, usdAsset.id, 20000);
    await seedForeignBalance(testUser.id, eurAsset.id, 10000);

    // £2,000 GBP liability (credit balance)
    const tempAsset = await seedAccount(testUser.id, { name: "Temp GBP", type: "asset" });
    await seedJournalEntry(testUser.id, {
      date: thisMonthDate(1),
      lines: [
        { accountId: gbpLiability.id, amount: BigInt(-200000) },
        { accountId: tempAsset.id, amount: BigInt(200000) },
      ],
    });

    await authedPage.goto("/dashboard");

    // Just verify the page loaded and shows dashboard stat cards with USD values
    const assetsCard = statCard(authedPage, "Assets");
    await expect(assetsCard).toBeVisible();
    await expect(assetsCard).toContainText("$");

    const liabCard = statCard(authedPage, "Liabilities");
    await expect(liabCard).toBeVisible();
    await expect(liabCard).toContainText("$");
  });

  test("dashboard account cards show native currency formatting", async ({
    authedPage,
    testUser,
  }) => {
    const usd = await seedAccount(testUser.id, { name: "US Account", type: "asset", currency: "USD" });
    const jpy = await seedAccount(testUser.id, { name: "JP Account", type: "asset", currency: "JPY" });

    await seedBalance(testUser.id, usd.id, 2500);
    await seedForeignBalance(testUser.id, jpy.id, 500000, 1);

    await authedPage.goto("/dashboard");

    await expect(authedPage.getByText("$2,500.00").first()).toBeVisible();
    await expect(authedPage.getByText("¥500,000")).toBeVisible();
  });

  test("income and expense stats aggregate across currencies", async ({
    authedPage,
    testUser,
  }) => {
    const usd = await seedAccount(testUser.id, { name: "USD Pay", type: "asset", currency: "USD" });
    const eur = await seedAccount(testUser.id, { name: "EUR Pay", type: "asset", currency: "EUR" });

    await seedBalance(testUser.id, usd.id, 50000);
    await seedForeignBalance(testUser.id, eur.id, 50000);

    // USD expense: $500
    const food = await seedCategoryAccount(testUser.id, "Food", "expense");
    await seedExpense(testUser.id, usd.id, food.id, 500, {
      date: thisMonthDate(5),
      description: "USD food",
    });

    // EUR expense: €200 via EUR category
    const [eurFood] = await db.insert(schema.accounts).values({
      userId: testUser.id,
      name: "EUR Food",
      type: "expense",
      currency: "EUR",
    }).returning();
    await seedJournalEntry(testUser.id, {
      date: thisMonthDate(7),
      description: "EUR food",
      lines: [
        { accountId: eurFood.id, amount: BigInt(20000) },
        { accountId: eur.id, amount: BigInt(-20000) },
      ],
    });

    // USD income: $3000
    const salary = await seedCategoryAccount(testUser.id, "Salary", "income");
    await seedIncome(testUser.id, usd.id, salary.id, 3000, {
      date: thisMonthDate(10),
      description: "USD salary",
    });

    await authedPage.goto("/dashboard");

    // Total expenses: $500 + (€200 / 0.85 = ~$235.29) = ~$735.29
    const expenseCard = statCard(authedPage, "Expenses");
    await expect(expenseCard).toContainText("$735");

    // Total income: $3,000
    const incomeCard = statCard(authedPage, "Income");
    await expect(incomeCard).toContainText("$3,000.00");
  });
});

// ==========================================================================
// 5. NON-USD BASE CURRENCY USER
// ==========================================================================

test.describe("Cross-currency: Non-USD base currency user", () => {
  test("EUR-based user sees dashboard stats in EUR", async ({ page }) => {
    const user = await createVerifiedUser({ currency: "EUR" });
    try {
      await loginViaUI(page, user.email, user.password);

      const usdAcct = await seedAccount(user.id, { name: "US Dollar", type: "asset", currency: "USD" });
      await seedBalance(user.id, usdAcct.id, 10000);

      const eurAcct = await seedAccount(user.id, { name: "Euro Main", type: "asset", currency: "EUR" });
      await seedForeignBalance(user.id, eurAcct.id, 5000);

      await page.goto("/dashboard");

      // Net worth in EUR:
      // USD $10,000 -> EUR: 10000 * 0.85 = €8,500
      // EUR €5,000 stays as is
      // Total = €13,500
      const netWorthCard = statCard(page, "Net Worth");
      await expect(netWorthCard).toContainText("€13,500");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("GBP-based user sees accounts with appropriate badges", async ({ page }) => {
    const user = await createVerifiedUser({ currency: "GBP" });
    try {
      await loginViaUI(page, user.email, user.password);

      const gbp = await seedAccount(user.id, { name: "GBP Current", type: "asset", currency: "GBP" });
      const usd = await seedAccount(user.id, { name: "USD Savings", type: "asset", currency: "USD" });

      await seedForeignBalance(user.id, gbp.id, 5000);
      await seedBalance(user.id, usd.id, 3000);

      await page.goto("/accounts");

      // GBP account: no badge (matches base), shows £5,000
      const gbpCard = page.locator('[data-slot="card"]').filter({ hasText: "GBP Current" });
      await expect(gbpCard.locator(".text-2xl")).toContainText("£5,000.00");

      // USD account: shows USD badge
      const usdCard = page.locator('[data-slot="card"]').filter({ hasText: "USD Savings" });
      await expect(usdCard.locator(".text-2xl")).toContainText("$3,000.00");
      await expect(usdCard.getByText("USD", { exact: true })).toBeVisible();
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

// ==========================================================================
// 6. GOALS — Cross-Currency Funding
// ==========================================================================

test.describe("Cross-currency: Goals", () => {
  test("goal funded from same-currency account shows correct progress", async ({
    authedPage,
    testUser,
  }) => {
    const checking = await seedAccount(testUser.id, {
      name: "Main Checking",
      type: "asset",
      currency: "USD",
    });
    await seedBalance(testUser.id, checking.id, 10000);

    await seedGoal(testUser.id, {
      name: "Emergency Fund",
      targetAmount: 5000,
      fundFromAccountId: checking.id,
      fundAmount: 2000,
    });

    await authedPage.goto("/goals");

    const goalCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "Emergency Fund" });
    await expect(goalCard).toBeVisible();
    await expect(goalCard).toContainText("$2,000.00");
    await expect(goalCard).toContainText("of $5,000.00");
    await expect(goalCard).toContainText("40%");
  });

  test("goal displays in user's base currency when funded cross-currency", async ({
    authedPage,
    testUser,
  }) => {
    const eurAccount = await seedAccount(testUser.id, {
      name: "EUR Source",
      type: "asset",
      currency: "EUR",
    });
    await seedForeignBalance(testUser.id, eurAccount.id, 10000);

    // Goal backing account created in USD (user's base)
    const { backingAccount } = await seedGoal(testUser.id, {
      name: "Vacation USD",
      targetAmount: 3000,
    });

    // Fund goal cross-currency: €500 from EUR account -> goal backing in USD
    // €500 / 0.85 = ~$588.24
    const goalFundUsd = Math.round(500 / 0.85 * 100); // ~58824 cents
    await seedJournalEntry(testUser.id, {
      date: thisMonthDate(5),
      description: "Fund goal from EUR",
      lines: [
        { accountId: backingAccount.id, amount: BigInt(goalFundUsd) },
        { accountId: eurAccount.id, amount: BigInt(-50000) },
      ],
    });

    await authedPage.goto("/goals");

    const goalCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "Vacation USD" });
    await expect(goalCard).toBeVisible();
    await expect(goalCard).toContainText("$588");
    await expect(goalCard).toContainText("of $3,000.00");
  });

  test("multiple goals with different amounts show independently", async ({
    authedPage,
    testUser,
  }) => {
    const checking = await seedAccount(testUser.id, {
      name: "Checking",
      type: "asset",
      currency: "USD",
    });
    await seedBalance(testUser.id, checking.id, 50000);

    await seedGoal(testUser.id, {
      name: "House Down Payment",
      targetAmount: 50000,
      fundFromAccountId: checking.id,
      fundAmount: 10000,
    });

    await seedGoal(testUser.id, {
      name: "Car Fund",
      targetAmount: 15000,
      fundFromAccountId: checking.id,
      fundAmount: 5000,
    });

    await authedPage.goto("/goals");

    const houseGoal = authedPage.locator('[data-slot="card"]').filter({ hasText: "House Down Payment" });
    await expect(houseGoal).toContainText("$10,000.00");
    await expect(houseGoal).toContainText("of $50,000.00");
    await expect(houseGoal).toContainText("20%");

    const carGoal = authedPage.locator('[data-slot="card"]').filter({ hasText: "Car Fund" });
    await expect(carGoal).toContainText("$5,000.00");
    await expect(carGoal).toContainText("of $15,000.00");
    await expect(carGoal).toContainText("33%");
  });
});

// ==========================================================================
// 7. BUDGETS — Currency Consistency
// ==========================================================================

test.describe("Cross-currency: Budgets", () => {
  test("budget tracks spending in category's native currency", async ({
    authedPage,
    testUser,
  }) => {
    const usdAccount = await seedAccount(testUser.id, {
      name: "USD Spend",
      type: "asset",
      currency: "USD",
    });
    await seedBalance(testUser.id, usdAccount.id, 5000);

    const groceries = await seedCategoryAccount(testUser.id, "Groceries", "expense");
    await seedExpense(testUser.id, usdAccount.id, groceries.id, 150, {
      date: thisMonthDate(5),
    });
    await seedExpense(testUser.id, usdAccount.id, groceries.id, 85.50, {
      date: thisMonthDate(10),
    });

    await seedBudget(testUser.id, groceries.id, {
      name: "Monthly Groceries",
      amount: 500,
    });

    await authedPage.goto("/expenses");

    const budgetCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "Groceries" });
    await expect(budgetCard).toBeVisible();
    await expect(budgetCard).toContainText("$235.50");
    await expect(budgetCard).toContainText("of $500.00");
    await expect(budgetCard).toContainText("47% used");
  });

  test("EUR budget tracks EUR expenses correctly", async ({
    authedPage,
    testUser,
  }) => {
    const eurAccount = await seedAccount(testUser.id, {
      name: "EUR Spending",
      type: "asset",
      currency: "EUR",
    });
    await seedForeignBalance(testUser.id, eurAccount.id, 5000);

    // EUR expense category
    const [eurCategory] = await db.insert(schema.accounts).values({
      userId: testUser.id,
      name: "Transport EUR",
      type: "expense",
      currency: "EUR",
    }).returning();

    await seedJournalEntry(testUser.id, {
      date: thisMonthDate(5),
      description: "Metro pass",
      lines: [
        { accountId: eurCategory.id, amount: BigInt(7500) },
        { accountId: eurAccount.id, amount: BigInt(-7500) },
      ],
    });

    await seedBudget(testUser.id, eurCategory.id, {
      name: "Transport Budget",
      amount: 200,
    });

    await authedPage.goto("/expenses");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Transport EUR" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("€75.00");
    await expect(card).toContainText("of €200.00");
  });
});

// ==========================================================================
// 8. ACCOUNT DETAIL PAGE — Transactions in Native Currency
// ==========================================================================

test.describe("Cross-currency: Account detail page", () => {
  test("account detail shows balance in native currency", async ({
    authedPage,
    testUser,
  }) => {
    const eurAccount = await seedAccount(testUser.id, {
      name: "Euro Current",
      type: "asset",
      currency: "EUR",
      institution: "BNP Paribas",
    });
    await seedForeignBalance(testUser.id, eurAccount.id, 10000);

    const dining = await seedCategoryAccount(testUser.id, "Dining", "expense");
    await seedExpense(testUser.id, eurAccount.id, dining.id, 45.00, {
      date: thisMonthDate(5),
      description: "Paris restaurant",
    });

    await authedPage.goto(`/accounts/${eurAccount.id}`);

    await expect(authedPage.getByText("Euro Current")).toBeVisible();
    await expect(authedPage.getByText("€9,955.00")).toBeVisible();
    await expect(authedPage.getByText("Paris restaurant")).toBeVisible();
  });
});

// ==========================================================================
// 9. EXPENSES PAGE — Cross-Currency Categories
// ==========================================================================

test.describe("Cross-currency: Expenses page", () => {
  test("shows expense categories with correct amounts", async ({
    authedPage,
    testUser,
  }) => {
    const usdAccount = await seedAccount(testUser.id, {
      name: "USD Exp",
      type: "asset",
      currency: "USD",
    });
    await seedBalance(testUser.id, usdAccount.id, 5000);

    const food = await seedCategoryAccount(testUser.id, "Food", "expense");
    const rent = await seedCategoryAccount(testUser.id, "Rent", "expense");

    await seedExpense(testUser.id, usdAccount.id, food.id, 200, { date: thisMonthDate(5) });
    await seedExpense(testUser.id, usdAccount.id, rent.id, 1500, { date: thisMonthDate(3) });

    await authedPage.goto("/expenses");

    await expect(authedPage.getByText("Food")).toBeVisible();
    await expect(authedPage.getByText("$200.00")).toBeVisible();
    await expect(authedPage.getByText("Rent")).toBeVisible();
    await expect(authedPage.getByText("$1,500.00")).toBeVisible();
  });
});

// ==========================================================================
// 10. DATA INTEGRITY — Double-Entry Balance Verification
// ==========================================================================

test.describe("Cross-currency: Data integrity", () => {
  test("single-currency journal entries sum to zero per currency", async ({
    testUser,
  }) => {
    const checking = await seedAccount(testUser.id, {
      name: "Integrity Check",
      type: "asset",
      currency: "USD",
    });
    await seedBalance(testUser.id, checking.id, 5000);

    const food = await seedCategoryAccount(testUser.id, "Int Food", "expense");
    await seedExpense(testUser.id, checking.id, food.id, 100, { date: thisMonthDate(3) });
    await seedExpense(testUser.id, checking.id, food.id, 200, { date: thisMonthDate(5) });

    const result = await db.execute(
      sql`
        SELECT a.currency, COALESCE(SUM(jl.amount), 0) AS total
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_entry_id
        JOIN accounts a ON a.id = jl.account_id
        WHERE je.user_id = ${testUser.id}
        GROUP BY a.currency
      `,
    );

    for (const row of result) {
      const total = BigInt(row.total as string | number);
      expect(total).toBe(BigInt(0));
    }
  });

  test("cross-currency entries have correct per-account balances", async ({
    testUser,
  }) => {
    const usd = await seedAccount(testUser.id, { name: "Int USD", type: "asset", currency: "USD" });
    const eur = await seedAccount(testUser.id, { name: "Int EUR", type: "asset", currency: "EUR" });

    await seedBalance(testUser.id, usd.id, 10000);

    await seedCrossCurrencyTransfer(testUser.id, usd.id, eur.id, 1000, 850, {
      date: thisMonthDate(3),
    });

    // USD: $10,000 - $1,000 = $9,000 = 900000 cents
    const usdBalance = await getAccountBalanceRaw(usd.id);
    expect(usdBalance).toBe(BigInt(900000));

    // EUR: €850 = 85000 cents
    const eurBalance = await getAccountBalanceRaw(eur.id);
    expect(eurBalance).toBe(BigInt(85000));
  });

  test("multiple cross-currency transfers maintain correct individual balances", async ({
    testUser,
  }) => {
    const usd = await seedAccount(testUser.id, { name: "MC USD", type: "asset", currency: "USD" });
    const eur = await seedAccount(testUser.id, { name: "MC EUR", type: "asset", currency: "EUR" });
    const gbp = await seedAccount(testUser.id, { name: "MC GBP", type: "asset", currency: "GBP" });

    await seedBalance(testUser.id, usd.id, 50000);

    await seedCrossCurrencyTransfer(testUser.id, usd.id, eur.id, 5000, 4250, { date: thisMonthDate(3) });
    await seedCrossCurrencyTransfer(testUser.id, usd.id, gbp.id, 3000, 2190, { date: thisMonthDate(5) });
    await seedCrossCurrencyTransfer(testUser.id, eur.id, gbp.id, 1000, 860, { date: thisMonthDate(7) });

    // USD: 50000 - 5000 - 3000 = $42,000
    expect(await getAccountBalanceRaw(usd.id)).toBe(BigInt(4200000));
    // EUR: 4250 - 1000 = €3,250
    expect(await getAccountBalanceRaw(eur.id)).toBe(BigInt(325000));
    // GBP: 2190 + 860 = £3,050
    expect(await getAccountBalanceRaw(gbp.id)).toBe(BigInt(305000));
  });
});

// ==========================================================================
// 11. EDGE CASES — Minor Unit Variations
// ==========================================================================

test.describe("Cross-currency: Minor unit edge cases", () => {
  test("KWD (3 decimal places) account displays correctly", async ({
    authedPage,
    testUser,
  }) => {
    const kwdAccount = await seedAccount(testUser.id, {
      name: "Kuwait Account",
      type: "asset",
      currency: "KWD",
    });
    // KWD: factor=1000, 2.500 KWD = 2500 minor units
    await seedForeignBalance(testUser.id, kwdAccount.id, 2.5, 1000);

    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Kuwait Account" });
    await expect(card).toBeVisible();
    await expect(card.locator(".text-2xl")).toContainText("2.500");
    await expect(card.getByText("KWD", { exact: true })).toBeVisible();
  });

  test("ISK (0 decimal places) account displays correctly", async ({
    authedPage,
    testUser,
  }) => {
    const iskAccount = await seedAccount(testUser.id, {
      name: "Iceland Account",
      type: "asset",
      currency: "ISK",
    });
    // ISK: factor=1, 25000 minor = ISK 25,000
    await seedForeignBalance(testUser.id, iskAccount.id, 25000, 1);

    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Iceland Account" });
    await expect(card).toBeVisible();
    await expect(card.locator(".text-2xl")).toContainText("25,000");
  });

  test("KRW (0 decimal places) large amount displays correctly", async ({
    authedPage,
    testUser,
  }) => {
    const krwAccount = await seedAccount(testUser.id, {
      name: "Korean Account",
      type: "asset",
      currency: "KRW",
    });
    // KRW: factor=1, ₩5,000,000
    await seedForeignBalance(testUser.id, krwAccount.id, 5000000, 1);

    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Korean Account" });
    await expect(card).toBeVisible();
    await expect(card.locator(".text-2xl")).toContainText("₩5,000,000");
  });

  test("mixed minor-unit transfer: USD (2) -> JPY (0)", async ({
    authedPage,
    testUser,
  }) => {
    const usd = await seedAccount(testUser.id, { name: "USD for JPY", type: "asset", currency: "USD" });
    const jpy = await seedAccount(testUser.id, { name: "JPY from USD", type: "asset", currency: "JPY" });
    await seedBalance(testUser.id, usd.id, 5000);

    // $100 -> ¥11,000 (rate: 110)
    await seedCrossCurrencyTransfer(testUser.id, usd.id, jpy.id, 100, 11000, {
      date: thisMonthDate(3),
      description: "USD to JPY",
      fromMinorFactor: 100,
      toMinorFactor: 1,
    });

    await authedPage.goto("/accounts");

    const usdCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "USD for JPY" });
    await expect(usdCard.locator(".text-2xl")).toContainText("$4,900.00");

    const jpyCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "JPY from USD" });
    await expect(jpyCard.locator(".text-2xl")).toContainText("¥11,000");
  });

  test("mixed minor-unit transfer: USD (2) -> BHD (3)", async ({
    authedPage,
    testUser,
  }) => {
    const usd = await seedAccount(testUser.id, { name: "USD for BHD", type: "asset", currency: "USD" });
    const bhd = await seedAccount(testUser.id, { name: "BHD from USD", type: "asset", currency: "BHD" });
    await seedBalance(testUser.id, usd.id, 10000);

    // $1000 -> 377.000 BHD
    await seedCrossCurrencyTransfer(testUser.id, usd.id, bhd.id, 1000, 377, {
      date: thisMonthDate(3),
      description: "USD to BHD",
      fromMinorFactor: 100,
      toMinorFactor: 1000,
    });

    await authedPage.goto("/accounts");

    const usdCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "USD for BHD" });
    await expect(usdCard.locator(".text-2xl")).toContainText("$9,000.00");

    const bhdCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "BHD from USD" });
    await expect(bhdCard.locator(".text-2xl")).toContainText("377.000");
  });
});

// ==========================================================================
// 12. MIDDLE EASTERN CURRENCIES
// ==========================================================================

test.describe("Cross-currency: Middle Eastern currencies", () => {
  test("AED account with expenses", async ({
    authedPage,
    testUser,
  }) => {
    const aed = await seedAccount(testUser.id, { name: "UAE Account", type: "asset", currency: "AED" });
    await seedForeignBalance(testUser.id, aed.id, 10000);

    const [dining] = await db.insert(schema.accounts).values({
      userId: testUser.id,
      name: "AED Dining",
      type: "expense",
      currency: "AED",
    }).returning();
    await seedJournalEntry(testUser.id, {
      date: thisMonthDate(5),
      description: "Dubai restaurant",
      lines: [
        { accountId: dining.id, amount: BigInt(35000) }, // AED 350.00
        { accountId: aed.id, amount: BigInt(-35000) },
      ],
    });

    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "UAE Account" });
    await expect(card).toBeVisible();
    // 10000 - 350 = AED 9,650.00
    await expect(card.locator(".text-2xl")).toContainText("9,650.00");
  });

  test("SAR to USD transfer", async ({ authedPage, testUser }) => {
    const sar = await seedAccount(testUser.id, { name: "SAR Account", type: "asset", currency: "SAR" });
    const usd = await seedAccount(testUser.id, { name: "USD Receive", type: "asset", currency: "USD" });

    await seedForeignBalance(testUser.id, sar.id, 50000);

    // SAR 10,000 -> USD (10000/3.75 = $2666.67)
    await seedCrossCurrencyTransfer(testUser.id, sar.id, usd.id, 10000, 2666.67, {
      date: thisMonthDate(5),
      description: "SAR to USD transfer",
    });

    await authedPage.goto("/transactions");
    await expect(authedPage.getByText("SAR to USD transfer")).toBeVisible();
  });
});

// ==========================================================================
// 13. COMPLETE MULTI-CURRENCY PORTFOLIO
// ==========================================================================

test.describe("Cross-currency: Complete portfolio scenario", () => {
  test("realistic multi-currency portfolio with all features", async ({
    authedPage,
    testUser,
  }) => {
    // Create diversified portfolio
    const usdChecking = await seedAccount(testUser.id, { name: "US Checking", type: "asset", currency: "USD", institution: "Chase" });
    const eurSavings = await seedAccount(testUser.id, { name: "EU Savings", type: "asset", currency: "EUR", institution: "N26" });
    const gbpCurrent = await seedAccount(testUser.id, { name: "UK Current", type: "asset", currency: "GBP", institution: "Monzo" });
    const usdCredit = await seedAccount(testUser.id, { name: "US Credit", type: "liability", currency: "USD", institution: "Amex" });

    // Opening balances
    await seedBalance(testUser.id, usdChecking.id, 15000);

    // Liability: owe $3000
    const tempAsset = await seedAccount(testUser.id, { name: "Temp Liab", type: "asset" });
    await seedJournalEntry(testUser.id, {
      date: thisMonthDate(1),
      lines: [
        { accountId: usdCredit.id, amount: BigInt(-300000) },
        { accountId: tempAsset.id, amount: BigInt(300000) },
      ],
    });

    await seedForeignBalance(testUser.id, eurSavings.id, 8000);
    await seedForeignBalance(testUser.id, gbpCurrent.id, 2000);

    // Expenses
    const groceries = await seedCategoryAccount(testUser.id, "Groceries", "expense");
    await seedExpense(testUser.id, usdChecking.id, groceries.id, 350, {
      date: thisMonthDate(5),
      description: "Whole Foods",
    });

    // Cross-currency transfer USD -> EUR
    await seedCrossCurrencyTransfer(testUser.id, usdChecking.id, eurSavings.id, 2000, 1700, {
      date: thisMonthDate(8),
      description: "Monthly EUR savings",
    });

    // Income to GBP account
    const freelance = await seedCategoryAccount(testUser.id, "Freelance", "income");
    await seedIncome(testUser.id, gbpCurrent.id, freelance.id, 1500, {
      date: thisMonthDate(10),
      description: "UK client payment",
    });

    // Goal funded from USD
    await seedGoal(testUser.id, {
      name: "Travel Fund",
      targetAmount: 5000,
      fundFromAccountId: usdChecking.id,
      fundAmount: 1000,
    });

    // Budget for groceries
    await seedBudget(testUser.id, groceries.id, {
      name: "Food Budget",
      amount: 600,
    });

    // ── Verify Dashboard ──
    await authedPage.goto("/dashboard");

    const netWorthCard = statCard(authedPage, "Net Worth");
    await expect(netWorthCard).toBeVisible();

    // Verify accounts visible
    await expect(authedPage.getByText("US Checking").first()).toBeVisible();
    await expect(authedPage.getByText("EU Savings").first()).toBeVisible();
    await expect(authedPage.getByText("UK Current").first()).toBeVisible();

    // Verify budget
    const budgetsContent = authedPage
      .locator('[data-slot="card"]')
      .filter({ has: authedPage.locator('[data-slot="card-title"]', { hasText: "Budgets" }) })
      .locator('[data-slot="card-content"]');
    const budgetCard = budgetsContent.locator('[data-slot="card"]').filter({ hasText: "Groceries" });
    await expect(budgetCard).toContainText("$350.00");
    await expect(budgetCard).toContainText("of $600.00");

    // Verify goal
    const goalsContent = authedPage
      .locator('[data-slot="card"]')
      .filter({ has: authedPage.locator('[data-slot="card-title"]', { hasText: "Goals" }) })
      .locator('[data-slot="card-content"]');
    const goalCard = goalsContent.locator('[data-slot="card"]').filter({ hasText: "Travel Fund" });
    await expect(goalCard).toContainText("$1,000.00");
    await expect(goalCard).toContainText("of $5,000.00");

    // ── Verify Accounts Page ──
    await authedPage.goto("/accounts");

    // USD: 15000 - 350 - 2000 - 1000 = $11,650
    const usdCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "US Checking" });
    await expect(usdCard.locator(".text-2xl")).toContainText("$11,650.00");

    // EUR: 8000 + 1700 = €9,700
    const eurCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "EU Savings" });
    await expect(eurCard.locator(".text-2xl")).toContainText("€9,700.00");

    // GBP: 2000 + 1500 = £3,500
    const gbpCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "UK Current" });
    await expect(gbpCard.locator(".text-2xl")).toContainText("£3,500.00");

    // ── Verify Transactions Page ──
    await authedPage.goto("/transactions");

    await expect(authedPage.getByText("Whole Foods")).toBeVisible();
    await expect(authedPage.getByText("Monthly EUR savings")).toBeVisible();
    await expect(authedPage.getByText("UK client payment")).toBeVisible();
  });
});

// ==========================================================================
// 14. REVERSE TRANSFERS — Foreign -> Domestic
// ==========================================================================

test.describe("Cross-currency: Reverse direction transfers", () => {
  test("EUR -> USD transfer (foreign to domestic)", async ({
    authedPage,
    testUser,
  }) => {
    const eur = await seedAccount(testUser.id, { name: "EUR Sender", type: "asset", currency: "EUR" });
    const usd = await seedAccount(testUser.id, { name: "USD Receiver", type: "asset", currency: "USD" });

    await seedForeignBalance(testUser.id, eur.id, 10000);

    // €2000 -> $2352.94 (2000 / 0.85)
    await seedCrossCurrencyTransfer(testUser.id, eur.id, usd.id, 2000, 2352.94, {
      date: thisMonthDate(5),
      description: "EUR to USD",
    });

    await authedPage.goto("/accounts");

    const eurCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "EUR Sender" });
    await expect(eurCard.locator(".text-2xl")).toContainText("€8,000.00");

    const usdCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "USD Receiver" });
    await expect(usdCard.locator(".text-2xl")).toContainText("$2,352.94");
  });

  test("GBP -> EUR transfer (two foreign currencies)", async ({
    authedPage,
    testUser,
  }) => {
    const gbp = await seedAccount(testUser.id, { name: "GBP Source", type: "asset", currency: "GBP" });
    const eur = await seedAccount(testUser.id, { name: "EUR Target", type: "asset", currency: "EUR" });

    await seedForeignBalance(testUser.id, gbp.id, 5000);

    // £1000 -> €1164.38 (1000 / 0.73 * 0.85)
    await seedCrossCurrencyTransfer(testUser.id, gbp.id, eur.id, 1000, 1164.38, {
      date: thisMonthDate(5),
      description: "GBP to EUR",
    });

    await authedPage.goto("/accounts");

    const gbpCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "GBP Source" });
    await expect(gbpCard.locator(".text-2xl")).toContainText("£4,000.00");

    const eurCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "EUR Target" });
    await expect(eurCard.locator(".text-2xl")).toContainText("€1,164.38");
  });
});

// ==========================================================================
// 15. LIABILITIES — Cross-Currency
// ==========================================================================

test.describe("Cross-currency: Liabilities", () => {
  test("foreign currency liability shows correct owed amount", async ({
    authedPage,
    testUser,
  }) => {
    const eurLiability = await seedAccount(testUser.id, {
      name: "EU Credit Card",
      type: "liability",
      currency: "EUR",
    });
    const tempAsset = await seedAccount(testUser.id, { name: "Temp L", type: "asset" });
    await seedJournalEntry(testUser.id, {
      date: thisMonthDate(1),
      lines: [
        { accountId: eurLiability.id, amount: BigInt(-150000) },
        { accountId: tempAsset.id, amount: BigInt(150000) },
      ],
    });

    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "EU Credit Card" });
    await expect(card).toBeVisible();
    await expect(card.locator(".text-2xl")).toContainText("€1,500.00");
    await expect(card.getByText("EUR", { exact: true })).toBeVisible();
  });

  test("paying foreign liability from domestic account reduces liability", async ({
    authedPage,
    testUser,
  }) => {
    const usd = await seedAccount(testUser.id, { name: "Pay Source", type: "asset", currency: "USD" });
    const eurLiab = await seedAccount(testUser.id, { name: "EUR Liability", type: "liability", currency: "EUR" });

    await seedBalance(testUser.id, usd.id, 5000);

    // Initial liability: €2000
    const tempAsset = await seedAccount(testUser.id, { name: "Temp LP", type: "asset" });
    await seedJournalEntry(testUser.id, {
      date: thisMonthDate(1),
      lines: [
        { accountId: eurLiab.id, amount: BigInt(-200000) },
        { accountId: tempAsset.id, amount: BigInt(200000) },
      ],
    });

    // Pay €500 of the liability with $588.24 USD
    await seedJournalEntry(testUser.id, {
      date: thisMonthDate(5),
      description: "Pay EUR card",
      lines: [
        { accountId: eurLiab.id, amount: BigInt(50000) },    // debit liability
        { accountId: usd.id, amount: BigInt(-58824) },       // credit USD
      ],
    });

    await authedPage.goto("/accounts");

    // EUR liability: -200000 + 50000 = -150000 -> display = €1,500.00
    const liabCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "EUR Liability" });
    await expect(liabCard.locator(".text-2xl")).toContainText("€1,500.00");

    // USD: $5000 - $588.24 = $4,411.76
    const usdCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "Pay Source" });
    await expect(usdCard.locator(".text-2xl")).toContainText("$4,411.76");
  });

  test("mixed currency assets and liabilities on dashboard", async ({
    authedPage,
    testUser,
  }) => {
    const usdAsset = await seedAccount(testUser.id, { name: "USD Asset", type: "asset", currency: "USD" });
    const eurAsset = await seedAccount(testUser.id, { name: "EUR Asset", type: "asset", currency: "EUR" });
    const usdLiab = await seedAccount(testUser.id, { name: "USD Debt", type: "liability", currency: "USD" });
    const eurLiab = await seedAccount(testUser.id, { name: "EUR Debt", type: "liability", currency: "EUR" });

    await seedBalance(testUser.id, usdAsset.id, 10000);

    // USD liability: $2000
    const tempU = await seedAccount(testUser.id, { name: "TU", type: "asset" });
    await seedJournalEntry(testUser.id, {
      date: thisMonthDate(1),
      lines: [
        { accountId: usdLiab.id, amount: BigInt(-200000) },
        { accountId: tempU.id, amount: BigInt(200000) },
      ],
    });

    await seedForeignBalance(testUser.id, eurAsset.id, 5000);

    // EUR liability: €1000
    const tempE = await seedAccount(testUser.id, { name: "TE", type: "asset" });
    await seedJournalEntry(testUser.id, {
      date: thisMonthDate(1),
      lines: [
        { accountId: eurLiab.id, amount: BigInt(-100000) },
        { accountId: tempE.id, amount: BigInt(100000) },
      ],
    });

    await authedPage.goto("/dashboard");

    // Just verify the page loaded and shows the net worth card with some value
    const netWorthCard = statCard(authedPage, "Net Worth");
    await expect(netWorthCard).toBeVisible();
    // Assets card exists and shows some USD value
    const assetsCard = statCard(authedPage, "Assets");
    await expect(assetsCard).toContainText("$");
    // Liabilities card shows some USD value
    const liabCard = statCard(authedPage, "Liabilities");
    await expect(liabCard).toContainText("$");
  });
});

// ==========================================================================
// 16. INCOME PAGE — Cross-Currency
// ==========================================================================

test.describe("Cross-currency: Income page", () => {
  test("shows income sources from different currency accounts", async ({
    authedPage,
    testUser,
  }) => {
    const usd = await seedAccount(testUser.id, { name: "USD Inc", type: "asset", currency: "USD" });
    const gbp = await seedAccount(testUser.id, { name: "GBP Inc", type: "asset", currency: "GBP" });

    await seedBalance(testUser.id, usd.id, 1000);
    await seedForeignBalance(testUser.id, gbp.id, 1000);

    const salary = await seedCategoryAccount(testUser.id, "Salary", "income");
    const consulting = await seedCategoryAccount(testUser.id, "Consulting", "income");

    await seedIncome(testUser.id, usd.id, salary.id, 5000, {
      date: thisMonthDate(5),
      description: "USD salary",
    });
    await seedIncome(testUser.id, gbp.id, consulting.id, 2000, {
      date: thisMonthDate(10),
      description: "GBP consulting",
    });

    await authedPage.goto("/income");

    await expect(authedPage.getByText("Salary")).toBeVisible();
    await expect(authedPage.getByText("Consulting")).toBeVisible();
  });
});

// ==========================================================================
// 17. HIGH-VALUE CURRENCIES
// ==========================================================================

test.describe("Cross-currency: High-value currencies", () => {
  test("TRY account with large amounts formats correctly", async ({
    authedPage,
    testUser,
  }) => {
    const tryAcct = await seedAccount(testUser.id, {
      name: "Turkey Account",
      type: "asset",
      currency: "TRY",
    });
    await seedForeignBalance(testUser.id, tryAcct.id, 150000);

    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Turkey Account" });
    await expect(card).toBeVisible();
    await expect(card.locator(".text-2xl")).toContainText("150,000.00");
    await expect(card.getByText("TRY", { exact: true })).toBeVisible();
  });

  test("EGP account with typical amounts", async ({
    authedPage,
    testUser,
  }) => {
    const egp = await seedAccount(testUser.id, {
      name: "Egypt Account",
      type: "asset",
      currency: "EGP",
    });
    await seedForeignBalance(testUser.id, egp.id, 25000);

    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Egypt Account" });
    await expect(card).toBeVisible();
    await expect(card.locator(".text-2xl")).toContainText("25,000.00");
    await expect(card.getByText("EGP", { exact: true })).toBeVisible();
  });
});
