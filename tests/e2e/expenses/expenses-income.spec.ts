import { test, expect } from "../../fixtures/auth";
import {
  seedAccount,
  seedCategoryAccount,
  seedExpense,
  seedIncome,
  seedBudget,
} from "../../fixtures/db-helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to a specific date via the ?date= query parameter. */
async function navigateToDate(page: import("@playwright/test").Page, path: string, date: string) {
  await page.goto(`${path}?date=${date}`);
}

/**
 * Format a number as USD currency the same way the app does.
 * The app uses `Intl.NumberFormat("en-US", { style: "currency", currency })`.
 */
function usd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Locate a category card by its name.
 * Cards use `data-slot="card"` and contain a CardTitle with the category name.
 */
function categoryCard(page: import("@playwright/test").Page, name: string) {
  return page.locator('[data-slot="card"]').filter({ hasText: name });
}

/**
 * Assert the bold amount displayed on a category card (the .text-2xl element).
 */
async function expectCardAmount(
  page: import("@playwright/test").Page,
  categoryName: string,
  amount: string,
) {
  const card = categoryCard(page, categoryName);
  await expect(card.locator(".text-2xl")).toContainText(amount);
}

/**
 * Assert the total line ("Total spent: $X" or "Total earned: $X").
 * The total is rendered as <p>Total {label}: <span>$X</span></p>.
 * We match the <p> by its leading text and then check its full text content.
 */
async function expectTotal(
  page: import("@playwright/test").Page,
  label: "spent" | "earned",
  amount: string,
) {
  const totalLine = page.locator(`text=Total ${label}:`);
  await expect(totalLine).toContainText(amount);
}

// Use a fixed month in the past to avoid "today" ambiguity across test runs.
const CURRENT_DATE = "2025-06-15";

// ═══════════════════════════════════════════════════════════════════════════
//  EXPENSES
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Expenses page", () => {
  test("1 - empty state when no expenses for the month", async ({ authedPage, testUser }) => {
    await navigateToDate(authedPage, "/expenses", CURRENT_DATE);

    await expect(authedPage.locator("h1")).toHaveText("Expense Categories");
    await expect(
      authedPage.getByText("No expense categories yet. Add your first one to get started."),
    ).toBeVisible();
    await expectTotal(authedPage, "spent", usd(0));
  });

  test("2 - single expense category with correct total", async ({ authedPage, testUser }) => {
    const checking = await seedAccount(testUser.id, { name: "Checking" });
    const groceries = await seedCategoryAccount(testUser.id, "Groceries", "expense");
    await seedExpense(testUser.id, checking.id, groceries.id, 42.5, {
      date: CURRENT_DATE,
      description: "Weekly groceries",
    });

    await navigateToDate(authedPage, "/expenses", CURRENT_DATE);

    // Category card should appear with the name and formatted total
    await expect(categoryCard(authedPage, "Groceries")).toBeVisible();
    await expectCardAmount(authedPage, "Groceries", usd(42.5));
    await expectTotal(authedPage, "spent", usd(42.5));
  });

  test("3 - multiple expense categories with correct totals", async ({ authedPage, testUser }) => {
    const checking = await seedAccount(testUser.id, { name: "Checking" });
    const groceries = await seedCategoryAccount(testUser.id, "Groceries", "expense");
    const dining = await seedCategoryAccount(testUser.id, "Dining", "expense");
    const rent = await seedCategoryAccount(testUser.id, "Rent", "expense");

    await seedExpense(testUser.id, checking.id, groceries.id, 100, { date: CURRENT_DATE });
    await seedExpense(testUser.id, checking.id, dining.id, 45.75, { date: CURRENT_DATE });
    await seedExpense(testUser.id, checking.id, rent.id, 1200, { date: CURRENT_DATE });

    await navigateToDate(authedPage, "/expenses", CURRENT_DATE);

    await expect(categoryCard(authedPage, "Groceries")).toBeVisible();
    await expect(categoryCard(authedPage, "Dining")).toBeVisible();
    await expect(categoryCard(authedPage, "Rent")).toBeVisible();

    // Each category card shows its own total in the .text-2xl element
    await expectCardAmount(authedPage, "Groceries", usd(100));
    await expectCardAmount(authedPage, "Dining", usd(45.75));
    await expectCardAmount(authedPage, "Rent", usd(1200));

    // Grand total
    const total = 100 + 45.75 + 1200;
    await expectTotal(authedPage, "spent", usd(total));
  });

  test("4 - expense category with budget shows spent vs limit", async ({
    authedPage,
    testUser,
  }) => {
    const checking = await seedAccount(testUser.id, { name: "Checking" });
    const groceries = await seedCategoryAccount(testUser.id, "Groceries", "expense");

    await seedExpense(testUser.id, checking.id, groceries.id, 150, { date: CURRENT_DATE });

    // Budget covers the entire month of June 2025
    await seedBudget(testUser.id, groceries.id, {
      name: "Grocery Budget",
      amount: 300,
      startDate: "2025-06-01",
      endDate: "2025-06-30",
    });

    await navigateToDate(authedPage, "/expenses", CURRENT_DATE);

    const card = categoryCard(authedPage, "Groceries");

    // Should show spent formatted amount in the bold element
    await expect(card.locator(".text-2xl")).toContainText(usd(150));
    // Should show the budget limit with "of" prefix
    await expect(card.getByText(`of ${usd(300)}`)).toBeVisible();
    // Should show remaining + percentage
    await expect(card.getByText(/\$150\.00 left/)).toBeVisible();
    await expect(card.getByText(/50% used/)).toBeVisible();
  });

  test("5 - over-budget category shows visual indicator", async ({ authedPage, testUser }) => {
    const checking = await seedAccount(testUser.id, { name: "Checking" });
    const dining = await seedCategoryAccount(testUser.id, "Dining Out", "expense");

    await seedExpense(testUser.id, checking.id, dining.id, 250, { date: CURRENT_DATE });

    await seedBudget(testUser.id, dining.id, {
      name: "Dining Budget",
      amount: 200,
      startDate: "2025-06-01",
      endDate: "2025-06-30",
    });

    await navigateToDate(authedPage, "/expenses", CURRENT_DATE);

    const card = categoryCard(authedPage, "Dining Out");

    // Over-budget: shows "$50.00 over" text
    await expect(card.getByText(/\$50\.00 over/)).toBeVisible();
    // Percentage should be 125%
    await expect(card.getByText(/125% used/)).toBeVisible();
    // The progress bar should have the negative (red) color class
    await expect(card.locator('[class*="bg-negative"]')).toBeVisible();
  });

  test("6 - under-budget category shows correct progress", async ({ authedPage, testUser }) => {
    const checking = await seedAccount(testUser.id, { name: "Checking" });
    const transport = await seedCategoryAccount(testUser.id, "Transport", "expense");

    await seedExpense(testUser.id, checking.id, transport.id, 30, { date: CURRENT_DATE });

    await seedBudget(testUser.id, transport.id, {
      name: "Transport Budget",
      amount: 200,
      startDate: "2025-06-01",
      endDate: "2025-06-30",
    });

    await navigateToDate(authedPage, "/expenses", CURRENT_DATE);

    const card = categoryCard(authedPage, "Transport");

    // 30 of 200 = 15%
    await expect(card.getByText(/\$170\.00 left/)).toBeVisible();
    await expect(card.getByText(/15% used/)).toBeVisible();
    // Under 75% -> positive color
    await expect(card.locator('[class*="bg-positive"]')).toBeVisible();
  });

  test("7 - expenses change when navigating to different month", async ({
    authedPage,
    testUser,
  }) => {
    const checking = await seedAccount(testUser.id, { name: "Checking" });
    const groceries = await seedCategoryAccount(testUser.id, "Groceries", "expense");

    // Expense in June 2025
    await seedExpense(testUser.id, checking.id, groceries.id, 80, {
      date: "2025-06-10",
      description: "June groceries",
    });
    // Expense in July 2025
    await seedExpense(testUser.id, checking.id, groceries.id, 120, {
      date: "2025-07-10",
      description: "July groceries",
    });

    // Navigate to June
    await navigateToDate(authedPage, "/expenses", "2025-06-15");
    await expectCardAmount(authedPage, "Groceries", usd(80));

    // Navigate to July
    await navigateToDate(authedPage, "/expenses", "2025-07-15");
    await expectCardAmount(authedPage, "Groceries", usd(120));
  });

  test("8 - category with multiple transactions sums correctly", async ({
    authedPage,
    testUser,
  }) => {
    const checking = await seedAccount(testUser.id, { name: "Checking" });
    const groceries = await seedCategoryAccount(testUser.id, "Groceries", "expense");

    // Multiple expenses in the same category, same month
    await seedExpense(testUser.id, checking.id, groceries.id, 25.5, {
      date: "2025-06-01",
      description: "Store A",
    });
    await seedExpense(testUser.id, checking.id, groceries.id, 33.75, {
      date: "2025-06-10",
      description: "Store B",
    });
    await seedExpense(testUser.id, checking.id, groceries.id, 10.25, {
      date: "2025-06-20",
      description: "Store C",
    });

    await navigateToDate(authedPage, "/expenses", CURRENT_DATE);

    // Total should be 25.50 + 33.75 + 10.25 = 69.50
    const expectedTotal = 25.5 + 33.75 + 10.25;
    await expectCardAmount(authedPage, "Groceries", usd(expectedTotal));
    await expectTotal(authedPage, "spent", usd(expectedTotal));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  INCOME
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Income page", () => {
  test("9 - empty state when no income for the month", async ({ authedPage, testUser }) => {
    await navigateToDate(authedPage, "/income", CURRENT_DATE);

    await expect(authedPage.locator("h1")).toHaveText("Income Sources");
    await expect(
      authedPage.getByText("No income sources yet. Add your first one to get started."),
    ).toBeVisible();
    await expectTotal(authedPage, "earned", usd(0));
  });

  test("10 - single income category with correct total", async ({ authedPage, testUser }) => {
    const checking = await seedAccount(testUser.id, { name: "Checking" });
    const salary = await seedCategoryAccount(testUser.id, "Salary", "income");

    await seedIncome(testUser.id, checking.id, salary.id, 5000, {
      date: CURRENT_DATE,
      description: "Monthly salary",
    });

    await navigateToDate(authedPage, "/income", CURRENT_DATE);

    await expect(categoryCard(authedPage, "Salary")).toBeVisible();
    await expectCardAmount(authedPage, "Salary", usd(5000));
    await expectTotal(authedPage, "earned", usd(5000));
  });

  test("11 - multiple income categories with correct totals", async ({
    authedPage,
    testUser,
  }) => {
    const checking = await seedAccount(testUser.id, { name: "Checking" });
    const salary = await seedCategoryAccount(testUser.id, "Salary", "income");
    const freelance = await seedCategoryAccount(testUser.id, "Freelance", "income");
    const dividends = await seedCategoryAccount(testUser.id, "Dividends", "income");

    await seedIncome(testUser.id, checking.id, salary.id, 5000, { date: CURRENT_DATE });
    await seedIncome(testUser.id, checking.id, freelance.id, 1200, { date: CURRENT_DATE });
    await seedIncome(testUser.id, checking.id, dividends.id, 350.5, { date: CURRENT_DATE });

    await navigateToDate(authedPage, "/income", CURRENT_DATE);

    await expect(categoryCard(authedPage, "Salary")).toBeVisible();
    await expect(categoryCard(authedPage, "Freelance")).toBeVisible();
    await expect(categoryCard(authedPage, "Dividends")).toBeVisible();

    await expectCardAmount(authedPage, "Salary", usd(5000));
    await expectCardAmount(authedPage, "Freelance", usd(1200));
    await expectCardAmount(authedPage, "Dividends", usd(350.5));

    const total = 5000 + 1200 + 350.5;
    await expectTotal(authedPage, "earned", usd(total));
  });

  test("12 - income changes when navigating to different month", async ({
    authedPage,
    testUser,
  }) => {
    const checking = await seedAccount(testUser.id, { name: "Checking" });
    const salary = await seedCategoryAccount(testUser.id, "Salary", "income");

    await seedIncome(testUser.id, checking.id, salary.id, 5000, {
      date: "2025-06-01",
      description: "June salary",
    });
    await seedIncome(testUser.id, checking.id, salary.id, 5500, {
      date: "2025-07-01",
      description: "July salary (raise)",
    });

    // Navigate to June
    await navigateToDate(authedPage, "/income", "2025-06-15");
    await expectCardAmount(authedPage, "Salary", usd(5000));

    // Navigate to July
    await navigateToDate(authedPage, "/income", "2025-07-15");
    await expectCardAmount(authedPage, "Salary", usd(5500));
  });

  test("13 - category with multiple income transactions sums correctly", async ({
    authedPage,
    testUser,
  }) => {
    const checking = await seedAccount(testUser.id, { name: "Checking" });
    const freelance = await seedCategoryAccount(testUser.id, "Freelance", "income");

    await seedIncome(testUser.id, checking.id, freelance.id, 500, {
      date: "2025-06-05",
      description: "Project A",
    });
    await seedIncome(testUser.id, checking.id, freelance.id, 750, {
      date: "2025-06-15",
      description: "Project B",
    });
    await seedIncome(testUser.id, checking.id, freelance.id, 300.25, {
      date: "2025-06-25",
      description: "Project C",
    });

    await navigateToDate(authedPage, "/income", CURRENT_DATE);

    const expectedTotal = 500 + 750 + 300.25;
    await expectCardAmount(authedPage, "Freelance", usd(expectedTotal));
    await expectTotal(authedPage, "earned", usd(expectedTotal));
  });

  test("14 - income page has correct heading and layout", async ({ authedPage, testUser }) => {
    const checking = await seedAccount(testUser.id, { name: "Checking" });
    const salary = await seedCategoryAccount(testUser.id, "Salary", "income");
    await seedIncome(testUser.id, checking.id, salary.id, 3000, { date: CURRENT_DATE });

    await navigateToDate(authedPage, "/income", CURRENT_DATE);

    // Page heading
    await expect(authedPage.locator("h1")).toHaveText("Income Sources");
    // "Add Source" button should be present
    await expect(authedPage.getByRole("button", { name: "Add Source" })).toBeVisible();
    // Should show "earned this month" label on the card
    const card = categoryCard(authedPage, "Salary");
    await expect(card.getByText("earned this month")).toBeVisible();
    // Total line
    await expect(authedPage.getByText(/Total earned:/)).toBeVisible();
  });

  test("15 - large income amounts format correctly", async ({ authedPage, testUser }) => {
    const checking = await seedAccount(testUser.id, { name: "Checking" });
    const salary = await seedCategoryAccount(testUser.id, "Salary", "income");

    // Seed a large income amount
    await seedIncome(testUser.id, checking.id, salary.id, 125750.99, {
      date: CURRENT_DATE,
      description: "Annual bonus",
    });

    await navigateToDate(authedPage, "/income", CURRENT_DATE);

    // Should be formatted with commas and cents: $125,750.99
    await expectCardAmount(authedPage, "Salary", usd(125750.99));
    await expectTotal(authedPage, "earned", usd(125750.99));
  });
});
