import { test, expect } from "../../fixtures/auth";
import {
  seedAccount,
  seedCategoryAccount,
  seedExpense,
  seedIncome,
  seedBalance,
  seedBudget,
  seedGoal,
} from "../../fixtures/db-helpers";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Current month's first day as YYYY-MM-DD. */
function thisMonthDate(day = 1): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** Previous month's first day as YYYY-MM-DD. */
function prevMonthDate(day = 15): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, day);
  const mm = String(prev.getMonth() + 1).padStart(2, "0");
  const dd = String(prev.getDate()).padStart(2, "0");
  return `${prev.getFullYear()}-${mm}-${dd}`;
}

/** Format a number as USD currency the same way the app does. */
function fmtUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

/**
 * Locate a summary stat card by its title text.
 * Uses data-slot="card" to scope to a single Card component.
 */
function statCard(page: import("@playwright/test").Page, title: string) {
  return page.locator('[data-slot="card"]').filter({ hasText: title }).first();
}

/**
 * Locate a dashboard section by its CardTitle heading text.
 * Returns the parent container that includes the heading and content.
 * CardTitle renders as a <div data-slot="card-title">, not <h2>.
 */
function section(page: import("@playwright/test").Page, heading: string) {
  return page.locator('[data-slot="card-title"]', { hasText: heading }).locator("..");
}

/**
 * Seeds a full set of realistic financial data for a user.
 * Returns all created entities for assertions.
 */
async function seedFullDashboard(userId: string) {
  // Asset accounts
  const checking = await seedAccount(userId, {
    name: "Checking",
    type: "asset",
    institution: "Chase",
  });
  const savings = await seedAccount(userId, {
    name: "Savings",
    type: "asset",
    institution: "Ally Bank",
  });

  // Liability account
  const creditCard = await seedAccount(userId, {
    name: "Credit Card",
    type: "liability",
    institution: "Amex",
  });

  // Set opening balances
  await seedBalance(userId, checking.id, 5000);
  await seedBalance(userId, savings.id, 10000);
  await seedBalance(userId, creditCard.id, 2000);

  // Category accounts
  const groceries = await seedCategoryAccount(userId, "Groceries", "expense");
  const rent = await seedCategoryAccount(userId, "Rent", "expense");
  const salary = await seedCategoryAccount(userId, "Salary", "income");

  const today = thisMonthDate(5);
  const today2 = thisMonthDate(10);
  const today3 = thisMonthDate(12);
  const today4 = thisMonthDate(15);

  // Expense transactions (current month)
  await seedExpense(userId, checking.id, groceries.id, 150, {
    date: today,
    description: "Whole Foods",
  });
  await seedExpense(userId, checking.id, groceries.id, 75.5, {
    date: today2,
    description: "Trader Joe's",
  });
  await seedExpense(userId, checking.id, rent.id, 1500, {
    date: today3,
    description: "March rent",
  });

  // Income transaction (current month)
  await seedIncome(userId, checking.id, salary.id, 6000, {
    date: today4,
    description: "Monthly salary",
  });

  // Budget for Groceries — $400 limit this month
  const budget = await seedBudget(userId, groceries.id, {
    name: "Grocery Budget",
    amount: 400,
  });

  // Goal — Vacation fund, $3000 target, $1000 funded from checking
  const { goal, backingAccount: goalAccount } = await seedGoal(userId, {
    name: "Vacation Fund",
    targetAmount: 3000,
    deadline: `${new Date().getFullYear()}-12-31`,
    fundFromAccountId: checking.id,
    fundAmount: 1000,
  });

  return {
    checking,
    savings,
    creditCard,
    groceries,
    rent,
    salary,
    budget,
    goal,
    goalAccount,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

test.describe("Dashboard", () => {
  test("1 — empty dashboard shows $0 stats and empty state messages", async ({
    authedPage,
  }) => {
    await authedPage.goto("/dashboard");

    // All 5 summary stat cards should show $0.00
    const zero = fmtUSD(0);
    await expect(statCard(authedPage, "Net Worth")).toContainText(zero);
    await expect(statCard(authedPage, "Assets")).toContainText(zero);
    await expect(statCard(authedPage, "Liabilities")).toContainText(zero);
    await expect(statCard(authedPage, "Income")).toContainText(zero);
    await expect(statCard(authedPage, "Expenses")).toContainText(zero);

    // Empty state messages
    await expect(authedPage.getByText("No accounts yet.")).toBeVisible();
    await expect(
      authedPage.getByText("No budgets this period."),
    ).toBeVisible();
    await expect(authedPage.getByText("No goals yet.")).toBeVisible();
    await expect(
      authedPage.getByText("No transactions yet."),
    ).toBeVisible();
  });

  test("2 — shows correct net worth (assets - liabilities)", async ({
    testUser,
    authedPage,
  }) => {
    await seedFullDashboard(testUser.id);
    await authedPage.goto("/dashboard");

    // Checking: 5000 - 150 - 75.50 - 1500 + 6000 - 1000 = 8274.50
    // Savings: 10000
    // Goal backing account: 1000 (HIDDEN from getAccountsWithBalances)
    // Visible assets: 8274.50 + 10000 = 18274.50
    // Credit card raw balance: +2000 (debit), display = -2000 (isLiability flips sign)
    // totalLiabilities = -2000 (sum of display balances)
    // Net worth = totalAssets - totalLiabilities = 18274.50 - (-2000) = 20274.50

    const assetsCard = statCard(authedPage, "Assets");
    await expect(assetsCard).toContainText(fmtUSD(18274.5));

    const liabilitiesCard = statCard(authedPage, "Liabilities");
    await expect(liabilitiesCard).toContainText(fmtUSD(2000));

    const netWorthCard = statCard(authedPage, "Net Worth");
    await expect(netWorthCard).toContainText(fmtUSD(20274.5));
  });

  test("3 — shows correct income and expense totals for the month", async ({
    testUser,
    authedPage,
  }) => {
    await seedFullDashboard(testUser.id);
    await authedPage.goto("/dashboard");

    // Total income this month: $6,000
    const incomeCard = statCard(authedPage, "Income");
    await expect(incomeCard).toContainText(fmtUSD(6000));

    // Total expenses this month: 150 + 75.50 + 1500 = $1,725.50
    const expenseCard = statCard(authedPage, "Expenses");
    await expect(expenseCard).toContainText(fmtUSD(1725.5));
  });

  test("4 — account cards display with correct balances and institutions", async ({
    testUser,
    authedPage,
  }) => {
    await seedFullDashboard(testUser.id);
    await authedPage.goto("/dashboard");

    // Scope to the Accounts section's card-content to avoid matching the outer section card
    const accountsContent = authedPage
      .locator('[data-slot="card"]')
      .filter({ has: authedPage.locator('[data-slot="card-title"]', { hasText: "Accounts" }) })
      .locator('[data-slot="card-content"]');

    // Checking account card
    const checkingCard = accountsContent
      .locator('[data-slot="card"]')
      .filter({ hasText: "Checking" })
      .filter({ hasText: "Chase" });
    await expect(checkingCard).toBeVisible();

    // Savings account card
    const savingsCard = accountsContent
      .locator('[data-slot="card"]')
      .filter({ hasText: "Savings" })
      .filter({ hasText: "Ally Bank" });
    await expect(savingsCard).toBeVisible();

    // Credit Card account
    const ccCard = accountsContent
      .locator('[data-slot="card"]')
      .filter({ hasText: "Credit Card" })
      .filter({ hasText: "Amex" });
    await expect(ccCard).toBeVisible();

    // Type badges
    await expect(authedPage.getByText("Bank & Cash").first()).toBeVisible();
    await expect(authedPage.getByText("Credit & Loans")).toBeVisible();
  });

  test("5 — budget cards show spent vs limit with progress", async ({
    testUser,
    authedPage,
  }) => {
    await seedFullDashboard(testUser.id);
    await authedPage.goto("/dashboard");

    // Scope to the Budgets section's card-content to avoid matching the outer section card
    const budgetsContent = authedPage
      .locator('[data-slot="card"]')
      .filter({ has: authedPage.locator('[data-slot="card-title"]', { hasText: "Budgets" }) })
      .locator('[data-slot="card-content"]');

    // Grocery Budget: spent $225.50 of $400
    const budgetCard = budgetsContent
      .locator('[data-slot="card"]')
      .filter({ hasText: "Grocery Budget" });
    await expect(budgetCard).toBeVisible();
    await expect(budgetCard).toContainText(fmtUSD(225.5));
    await expect(budgetCard).toContainText(`of ${fmtUSD(400)}`);

    // Progress indicator — should show percentage used
    // 225.50 / 400 = 56.375% => rounded to 56%
    await expect(budgetCard).toContainText("56% used");

    // Remaining
    await expect(budgetCard).toContainText("left");

    // Category badge
    await expect(budgetCard).toContainText("Groceries");
  });

  test("6 — goal cards show progress toward target", async ({
    testUser,
    authedPage,
  }) => {
    await seedFullDashboard(testUser.id);
    await authedPage.goto("/dashboard");

    // Scope to the Goals section's card-content to avoid matching the outer section card
    // or the Recent Transactions section (which may contain goal-funding transaction descriptions)
    const goalsContent = authedPage
      .locator('[data-slot="card"]')
      .filter({ has: authedPage.locator('[data-slot="card-title"]', { hasText: "Goals" }) })
      .locator('[data-slot="card-content"]');

    // Vacation Fund: $1,000 of $3,000 target = 33%
    const goalCard = goalsContent
      .locator('[data-slot="card"]')
      .filter({ hasText: "Vacation Fund" });
    await expect(goalCard).toBeVisible();
    await expect(goalCard).toContainText(fmtUSD(1000));
    await expect(goalCard).toContainText(`of ${fmtUSD(3000)}`);
    await expect(goalCard).toContainText("33%");

    // Deadline
    await expect(goalCard).toContainText("Deadline:");
  });

  test("7 — recent transactions section displays seeded transactions", async ({
    testUser,
    authedPage,
  }) => {
    await seedFullDashboard(testUser.id);
    await authedPage.goto("/dashboard");

    // Should show the seeded transactions
    await expect(authedPage.getByText("Whole Foods")).toBeVisible();
    await expect(authedPage.getByText("Trader Joe's")).toBeVisible();
    await expect(authedPage.getByText("March rent")).toBeVisible();
    await expect(authedPage.getByText("Monthly salary")).toBeVisible();

    // The "No transactions yet." empty state should NOT be visible
    await expect(authedPage.getByText("No transactions yet.")).not.toBeVisible();
  });

  test("8 — 'View all' links navigate to correct pages", async ({
    authedPage,
  }) => {
    await authedPage.goto("/dashboard");

    // Accounts "View all"
    const accountsSection = section(authedPage, "Accounts");
    const accountsLink = accountsSection.getByRole("link", { name: "View all" });
    await expect(accountsLink).toHaveAttribute("href", "/accounts");

    // Budgets "View all"
    const budgetsSection = section(authedPage, "Budgets");
    const budgetsLink = budgetsSection.getByRole("link", { name: "View all" });
    await expect(budgetsLink).toHaveAttribute("href", "/budgets");

    // Goals "View all"
    const goalsSection = section(authedPage, "Goals");
    const goalsLink = goalsSection.getByRole("link", { name: "View all" });
    await expect(goalsLink).toHaveAttribute("href", "/goals");

    // Recent Transactions "View all"
    const txnSection = section(authedPage, "Recent Transactions");
    const txnLink = txnSection.getByRole("link", { name: "View all" });
    await expect(txnLink).toHaveAttribute("href", "/transactions");

    // Actually click one and verify navigation
    await accountsLink.click();
    await authedPage.waitForURL("**/accounts");
    expect(authedPage.url()).toContain("/accounts");
  });

  test("9 — empty state messages include 'Add one' / 'Create one' links", async ({
    authedPage,
  }) => {
    await authedPage.goto("/dashboard");

    // "No accounts yet. Add one" — link goes to /accounts
    const addAccountLink = authedPage.getByRole("link", { name: "Add one" });
    await expect(addAccountLink).toBeVisible();
    await expect(addAccountLink).toHaveAttribute("href", "/accounts");

    // "No budgets this period. Create one" — link goes to /budgets
    const createBudgetLink = authedPage
      .getByText("No budgets this period.")
      .locator("..")
      .getByRole("link", { name: "Create one" });
    await expect(createBudgetLink).toBeVisible();
    await expect(createBudgetLink).toHaveAttribute("href", "/budgets");

    // "No goals yet. Create one" — link goes to /goals
    const createGoalLink = authedPage
      .getByText("No goals yet.")
      .locator("..")
      .getByRole("link", { name: "Create one" });
    await expect(createGoalLink).toBeVisible();
    await expect(createGoalLink).toHaveAttribute("href", "/goals");
  });

  test("10 — summary stats update when navigating to a different month via date selector", async ({
    testUser,
    authedPage,
  }) => {
    // Seed current month data
    const checking = await seedAccount(testUser.id, {
      name: "Checking",
      type: "asset",
      institution: "Chase",
    });
    await seedBalance(testUser.id, checking.id, 5000);

    const groceries = await seedCategoryAccount(testUser.id, "Groceries", "expense");
    const salary = await seedCategoryAccount(testUser.id, "Salary", "income");

    // Current month: $3000 income, $200 expenses
    await seedIncome(testUser.id, checking.id, salary.id, 3000, {
      date: thisMonthDate(10),
      description: "Current month salary",
    });
    await seedExpense(testUser.id, checking.id, groceries.id, 200, {
      date: thisMonthDate(12),
      description: "Current month groceries",
    });

    // Previous month: $4000 income, $500 expenses
    await seedIncome(testUser.id, checking.id, salary.id, 4000, {
      date: prevMonthDate(10),
      description: "Previous month salary",
    });
    await seedExpense(testUser.id, checking.id, groceries.id, 500, {
      date: prevMonthDate(12),
      description: "Previous month groceries",
    });

    // Load dashboard — should show current month stats
    await authedPage.goto("/dashboard");

    const incomeCard = statCard(authedPage, "Income");
    const expenseCard = statCard(authedPage, "Expenses");

    await expect(incomeCard).toContainText(fmtUSD(3000));
    await expect(expenseCard).toContainText(fmtUSD(200));

    // Navigate to previous month via URL param
    const prevDate = prevMonthDate(15);
    await authedPage.goto(`/dashboard?date=${prevDate}`);

    // Previous month stats — re-locate since we navigated
    const prevIncomeCard = statCard(authedPage, "Income");
    const prevExpenseCard = statCard(authedPage, "Expenses");

    await expect(prevIncomeCard).toContainText(fmtUSD(4000));
    await expect(prevExpenseCard).toContainText(fmtUSD(500));

    // Verify current month transactions are NOT shown in previous month view
    await expect(authedPage.getByText("Current month salary")).not.toBeVisible();
    await expect(authedPage.getByText("Current month groceries")).not.toBeVisible();

    // Previous month transactions should be visible
    await expect(authedPage.getByText("Previous month salary")).toBeVisible();
    await expect(authedPage.getByText("Previous month groceries")).toBeVisible();
  });
});
