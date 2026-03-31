import { test, expect } from "../../fixtures/auth";
import { db } from "../../fixtures/auth";
import { budgets } from "../../../src/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  seedAccount,
  seedCategoryAccount,
  seedExpense,
  seedBudget,
} from "../../fixtures/db-helpers";

// ---------------------------------------------------------------------------
// Budgets E2E tests
//
// Budgets are displayed inline on the /expenses page as part of each expense
// category card. The /budgets route simply redirects to /expenses.
// ---------------------------------------------------------------------------

// Helper: get the first day and last day of a given month as YYYY-MM-DD.
function monthRange(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { startDate, endDate };
}

// Use March 2026 as the test month (matches currentDate context).
const TEST_YEAR = 2026;
const TEST_MONTH = 3;
const { startDate: MONTH_START, endDate: MONTH_END } = monthRange(TEST_YEAR, TEST_MONTH);
const MID_MONTH = `${TEST_YEAR}-${String(TEST_MONTH).padStart(2, "0")}-15`;
const DATE_PARAM = `?date=${MID_MONTH}`;

/** Locate a category card by its title text. */
function cardByName(page: import("@playwright/test").Page, name: string) {
  return page.locator('[data-slot="card"]').filter({ hasText: name });
}

test.describe("Budgets", () => {
  // ── 1. /budgets redirects to /expenses ──────────────────────────────────
  test("redirects /budgets to /expenses", async ({ authedPage }) => {
    await authedPage.goto("/budgets");
    await authedPage.waitForURL(/\/expenses/);
    await expect(authedPage).toHaveURL(/\/expenses/);
  });

  // ── 2. Budget displays spent vs limit on expense category card ──────────
  test("displays spent vs limit on expense category card", async ({
    authedPage,
    testUser,
  }) => {
    const asset = await seedAccount(testUser.id, { name: "Checking" });
    const groceries = await seedCategoryAccount(testUser.id, "Groceries", "expense");

    await seedBudget(testUser.id, groceries.id, {
      name: "Groceries Budget",
      amount: 500,
      startDate: MONTH_START,
      endDate: MONTH_END,
    });

    await seedExpense(testUser.id, asset.id, groceries.id, 200, {
      date: MID_MONTH,
      description: "Weekly groceries",
    });

    await authedPage.goto(`/expenses${DATE_PARAM}`);

    const card = cardByName(authedPage, "Groceries");
    await expect(card.locator(".text-2xl")).toContainText("$200.00");
    await expect(card).toContainText("of $500.00");
  });

  // ── 3. Budget under limit -- progress bar shows correct percentage ──────
  test("under-limit budget shows correct progress percentage", async ({
    authedPage,
    testUser,
  }) => {
    const asset = await seedAccount(testUser.id, { name: "Checking" });
    const dining = await seedCategoryAccount(testUser.id, "Dining", "expense");

    await seedBudget(testUser.id, dining.id, {
      name: "Dining Budget",
      amount: 400,
      startDate: MONTH_START,
      endDate: MONTH_END,
    });

    // Spend $100 of $400 = 25%
    await seedExpense(testUser.id, asset.id, dining.id, 100, {
      date: MID_MONTH,
      description: "Restaurant",
    });

    await authedPage.goto(`/expenses${DATE_PARAM}`);

    const card = cardByName(authedPage, "Dining");
    await expect(card).toContainText("25% used");
    await expect(card).toContainText("$300.00 left");

    // Progress bar should have bg-positive (< 75%)
    await expect(card.locator(".bg-positive")).toBeVisible();
  });

  // ── 4. Budget at limit -- 100% progress ─────────────────────────────────
  test("at-limit budget shows 100% progress", async ({
    authedPage,
    testUser,
  }) => {
    const asset = await seedAccount(testUser.id, { name: "Checking" });
    const transport = await seedCategoryAccount(testUser.id, "Transport", "expense");

    await seedBudget(testUser.id, transport.id, {
      name: "Transport Budget",
      amount: 200,
      startDate: MONTH_START,
      endDate: MONTH_END,
    });

    // Spend exactly $200 of $200 = 100%
    await seedExpense(testUser.id, asset.id, transport.id, 200, {
      date: MID_MONTH,
      description: "Monthly pass",
    });

    await authedPage.goto(`/expenses${DATE_PARAM}`);

    const card = cardByName(authedPage, "Transport");
    await expect(card).toContainText("100% used");
    await expect(card).toContainText("$0.00 left");

    // At 100% (>= 90%), the bar should be bg-negative
    await expect(card.locator(".bg-negative")).toBeVisible();
  });

  // ── 5. Budget over limit -- visual indicator ────────────────────────────
  test("over-limit budget shows negative visual indicator", async ({
    authedPage,
    testUser,
  }) => {
    const asset = await seedAccount(testUser.id, { name: "Checking" });
    const shopping = await seedCategoryAccount(testUser.id, "Shopping", "expense");

    await seedBudget(testUser.id, shopping.id, {
      name: "Shopping Budget",
      amount: 300,
      startDate: MONTH_START,
      endDate: MONTH_END,
    });

    // Spend $450 of $300 = 150% over budget
    await seedExpense(testUser.id, asset.id, shopping.id, 450, {
      date: MID_MONTH,
      description: "Splurge",
    });

    await authedPage.goto(`/expenses${DATE_PARAM}`);

    const card = cardByName(authedPage, "Shopping");
    // Should show "over" indicator instead of "left"
    await expect(card).toContainText("$150.00 over");
    await expect(card).toContainText("150% used");

    // The bar should be bg-negative (>= 90%)
    await expect(card.locator(".bg-negative")).toBeVisible();
  });

  // ── 6. Budget with no spending -- shows $0 spent ────────────────────────
  test("budget with no spending shows $0.00 spent", async ({
    authedPage,
    testUser,
  }) => {
    const utilities = await seedCategoryAccount(testUser.id, "Utilities", "expense");

    await seedBudget(testUser.id, utilities.id, {
      name: "Utilities Budget",
      amount: 150,
      startDate: MONTH_START,
      endDate: MONTH_END,
    });

    await authedPage.goto(`/expenses${DATE_PARAM}`);

    const card = cardByName(authedPage, "Utilities");
    await expect(card.locator(".text-2xl")).toContainText("$0.00");
    await expect(card).toContainText("of $150.00");
    await expect(card).toContainText("$150.00 left");
    await expect(card).toContainText("0% used");
  });

  // ── 7. Multiple budgets for different categories ────────────────────────
  test("multiple budgets display correctly on separate category cards", async ({
    authedPage,
    testUser,
  }) => {
    const asset = await seedAccount(testUser.id, { name: "Checking" });
    const food = await seedCategoryAccount(testUser.id, "Food", "expense");
    const rent = await seedCategoryAccount(testUser.id, "Rent", "expense");
    const fun = await seedCategoryAccount(testUser.id, "Entertainment", "expense");

    await seedBudget(testUser.id, food.id, {
      name: "Food Budget",
      amount: 600,
      startDate: MONTH_START,
      endDate: MONTH_END,
    });
    await seedBudget(testUser.id, rent.id, {
      name: "Rent Budget",
      amount: 1500,
      startDate: MONTH_START,
      endDate: MONTH_END,
    });
    await seedBudget(testUser.id, fun.id, {
      name: "Fun Budget",
      amount: 200,
      startDate: MONTH_START,
      endDate: MONTH_END,
    });

    await seedExpense(testUser.id, asset.id, food.id, 250, {
      date: MID_MONTH,
      description: "Groceries",
    });
    await seedExpense(testUser.id, asset.id, rent.id, 1500, {
      date: MID_MONTH,
      description: "Monthly rent",
    });
    await seedExpense(testUser.id, asset.id, fun.id, 50, {
      date: MID_MONTH,
      description: "Movie tickets",
    });

    await authedPage.goto(`/expenses${DATE_PARAM}`);

    // Food card: $250 of $600
    const foodCard = cardByName(authedPage, "Food");
    await expect(foodCard.locator(".text-2xl")).toContainText("$250.00");
    await expect(foodCard).toContainText("of $600.00");

    // Rent card: $1,500 of $1,500 (at limit)
    const rentCard = cardByName(authedPage, "Rent");
    await expect(rentCard.locator(".text-2xl")).toContainText("$1,500.00");
    await expect(rentCard).toContainText("of $1,500.00");

    // Entertainment card: $50 of $200
    const funCard = cardByName(authedPage, "Entertainment");
    await expect(funCard.locator(".text-2xl")).toContainText("$50.00");
    await expect(funCard).toContainText("of $200.00");
  });

  // ── 8. Budget only counts expenses within its date range ────────────────
  test("budget only counts expenses within its date range", async ({
    authedPage,
    testUser,
  }) => {
    const asset = await seedAccount(testUser.id, { name: "Checking" });
    const coffee = await seedCategoryAccount(testUser.id, "Coffee", "expense");

    await seedBudget(testUser.id, coffee.id, {
      name: "Coffee Budget",
      amount: 100,
      startDate: MONTH_START,
      endDate: MONTH_END,
    });

    // Expense within the budget date range -- should count
    await seedExpense(testUser.id, asset.id, coffee.id, 30, {
      date: MID_MONTH,
      description: "Latte in range",
    });

    // Expense BEFORE the budget start -- should NOT count
    await seedExpense(testUser.id, asset.id, coffee.id, 50, {
      date: "2026-02-15",
      description: "Latte before range",
    });

    // Expense AFTER the budget end -- should NOT count
    await seedExpense(testUser.id, asset.id, coffee.id, 40, {
      date: "2026-04-10",
      description: "Latte after range",
    });

    await authedPage.goto(`/expenses${DATE_PARAM}`);

    // Only the $30 in-range expense should be counted
    const card = cardByName(authedPage, "Coffee");
    await expect(card.locator(".text-2xl")).toContainText("$30.00");
    await expect(card).toContainText("of $100.00");
    await expect(card).toContainText("$70.00 left");
  });

  // ── 9. Budget with custom date range shows correct spending ─────────────
  test("budget with custom date range shows correct spending", async ({
    authedPage,
    testUser,
  }) => {
    const asset = await seedAccount(testUser.id, { name: "Checking" });
    const gym = await seedCategoryAccount(testUser.id, "Gym", "expense");

    // Custom date range: March 10 - March 20
    await seedBudget(testUser.id, gym.id, {
      name: "Gym Budget",
      amount: 200,
      startDate: "2026-03-10",
      endDate: "2026-03-20",
    });

    // Expense on March 15 -- within custom range
    await seedExpense(testUser.id, asset.id, gym.id, 80, {
      date: "2026-03-15",
      description: "Gym session",
    });

    // Expense on March 5 -- outside custom range
    await seedExpense(testUser.id, asset.id, gym.id, 60, {
      date: "2026-03-05",
      description: "Gym before range",
    });

    // Navigate to a date within the custom range so the budget is active
    await authedPage.goto("/expenses?date=2026-03-15");

    const card = cardByName(authedPage, "Gym");
    // Only the $80 within the custom range should count
    await expect(card.locator(".text-2xl")).toContainText("$80.00");
    await expect(card).toContainText("of $200.00");
    await expect(card).toContainText("$120.00 left");
  });

  // ── 10. Inactive budget (isActive=false) is not displayed ───────────────
  test("inactive budget is not displayed on category card", async ({
    authedPage,
    testUser,
  }) => {
    const asset = await seedAccount(testUser.id, { name: "Checking" });
    const travel = await seedCategoryAccount(testUser.id, "Travel", "expense");

    const budget = await seedBudget(testUser.id, travel.id, {
      name: "Travel Budget",
      amount: 1000,
      startDate: MONTH_START,
      endDate: MONTH_END,
    });

    // Deactivate the budget directly in the DB
    await db
      .update(budgets)
      .set({ isActive: false })
      .where(eq(budgets.id, budget.id));

    await seedExpense(testUser.id, asset.id, travel.id, 300, {
      date: MID_MONTH,
      description: "Flight",
    });

    await authedPage.goto(`/expenses${DATE_PARAM}`);

    // The Travel card should exist but should NOT show budget info.
    // Instead it should show the regular "spent this month" layout
    // with a "Set Budget" button available.
    const card = cardByName(authedPage, "Travel");
    await expect(card).toBeVisible();

    // Should show the category total, not budget format
    await expect(card).toContainText("spent this month");

    // Should NOT show "of $1,000.00" (budget format)
    await expect(card).not.toContainText("of $1,000.00");
  });

  // ── 11. Budget progress calculation accuracy ────────────────────────────
  test("budget progress calculation is accurate", async ({
    authedPage,
    testUser,
  }) => {
    const asset = await seedAccount(testUser.id, { name: "Checking" });
    const subs = await seedCategoryAccount(testUser.id, "Subscriptions", "expense");

    await seedBudget(testUser.id, subs.id, {
      name: "Subs Budget",
      amount: 500,
      startDate: MONTH_START,
      endDate: MONTH_END,
    });

    // Spend $150 of $500 = 30%
    await seedExpense(testUser.id, asset.id, subs.id, 150, {
      date: MID_MONTH,
      description: "Netflix + Spotify",
    });

    await authedPage.goto(`/expenses${DATE_PARAM}`);

    const card = cardByName(authedPage, "Subscriptions");
    await expect(card.locator(".text-2xl")).toContainText("$150.00");
    await expect(card).toContainText("of $500.00");
    await expect(card).toContainText("$350.00 left");
    await expect(card).toContainText("30% used");

    // Progress bar should be green (< 75%)
    await expect(card.locator(".bg-positive")).toBeVisible();
  });

  // ── 12. Budget amount formatting (currency symbol, decimals) ────────────
  test("budget amounts are formatted with currency symbol and decimals", async ({
    authedPage,
    testUser,
  }) => {
    const asset = await seedAccount(testUser.id, { name: "Checking" });
    const misc = await seedCategoryAccount(testUser.id, "Miscellaneous", "expense");

    await seedBudget(testUser.id, misc.id, {
      name: "Misc Budget",
      amount: 1234.56,
      startDate: MONTH_START,
      endDate: MONTH_END,
    });

    // Spend $567.89 to verify decimal formatting
    await seedExpense(testUser.id, asset.id, misc.id, 567.89, {
      date: MID_MONTH,
      description: "Various items",
    });

    await authedPage.goto(`/expenses${DATE_PARAM}`);

    const card = cardByName(authedPage, "Miscellaneous");

    // Verify currency formatting: $ sign, comma separators, two decimal places
    await expect(card.locator(".text-2xl")).toContainText("$567.89");
    await expect(card).toContainText("of $1,234.56");
    await expect(card).toContainText("$666.67 left");
  });
});
