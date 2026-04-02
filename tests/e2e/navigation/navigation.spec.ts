import { test, expect } from "../../fixtures/auth";
import {
  seedAccount,
  seedCategoryAccount,
  seedExpense,
  seedBalance,
  seedIncome,
  seedTransfer,
  assertDoubleEntryBalanced,
  getAccountBalanceRaw,
} from "../../fixtures/db-helpers";

// ── Navigation ─────────────────────────────────────────────────────────

const navItems = [
  { title: "New Chat", href: "/chat" },
  { title: "Dashboard", href: "/dashboard" },
  { title: "Accounts", href: "/accounts" },
  { title: "Expenses", href: "/expenses" },
  { title: "Income", href: "/income" },
  { title: "Transactions", href: "/transactions" },
  { title: "Goals", href: "/goals" },
] as const;

test.describe("Navigation", () => {
  test("1 — sidebar navigation links navigate to correct pages", async ({
    authedPage: page,
  }) => {
    for (const item of navItems) {
      const link = page.locator(`[data-slot="sidebar"] a[href*="${item.href}"]`);
      await link.click();
      await page.waitForURL((url) => url.pathname.startsWith(item.href));
      expect(page.url()).toContain(item.href);
    }
  });

  test("2 — active page is visually highlighted in sidebar", async ({
    authedPage: page,
  }) => {
    // Navigate to Accounts
    await page.locator(`[data-slot="sidebar"] a[href*="/accounts"]`).click();
    await page.waitForURL((url) => url.pathname.startsWith("/accounts"));

    // The active menu button should have data-active attribute (boolean, no value)
    const accountsButton = page.locator(
      `[data-slot="sidebar-menu-button"][data-active]`,
    );
    await expect(accountsButton).toBeVisible();
    await expect(accountsButton).toContainText("Accounts");

    // Navigate to Goals
    await page.locator(`[data-slot="sidebar"] a[href*="/goals"]`).click();
    await page.waitForURL((url) => url.pathname.startsWith("/goals"));

    const goalsButton = page.locator(
      `[data-slot="sidebar-menu-button"][data-active]`,
    );
    await expect(goalsButton).toBeVisible();
    await expect(goalsButton).toContainText("Goals");
  });

  test("3 — 404 page for invalid routes", async ({ authedPage: page }) => {
    await page.goto("/nonexistent-page");
    await expect(page.getByText("Page not found")).toBeVisible();
  });

  test("4 — 404 page has link to home", async ({ authedPage: page }) => {
    await page.goto("/nonexistent-page");
    const homeLink = page.getByRole("link", { name: "Go home" });
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute("href", "/");
    await homeLink.click();
    // Root "/" redirects to "/chat"
    await page.waitForURL((url) =>
      url.pathname === "/" || url.pathname === "/chat",
    );
  });

  test("5 — sidebar toggle button works", async ({ authedPage: page }) => {
    // The sidebar trigger should be visible in the header
    const trigger = page.locator('[data-sidebar="trigger"]');
    await expect(trigger).toBeVisible();

    // Desktop: the sidebar element has data-state on the outer wrapper
    const sidebarEl = page.locator('[data-slot="sidebar"]:not([data-mobile="true"])');
    await expect(sidebarEl).toHaveAttribute("data-state", "expanded");

    // Click the trigger to collapse
    await trigger.click();
    await expect(sidebarEl).toHaveAttribute("data-state", "collapsed");

    // Click again to re-expand
    await trigger.click();
    await expect(sidebarEl).toHaveAttribute("data-state", "expanded");
  });

  test("6 — date selector next day changes date param", async ({
    authedPage: page,
  }) => {
    // Navigate to dashboard first
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    // Click next day
    const nextBtn = page.getByRole("button", { name: "Next day" });
    await nextBtn.click();

    // URL should now have a date param
    await page.waitForURL((url) => url.searchParams.has("date"));
    const url = new URL(page.url());
    const dateParam = url.searchParams.get("date");
    expect(dateParam).toBeTruthy();
    // The date should be a valid YYYY-MM-DD string
    expect(dateParam).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("7 — date selector previous day changes date param", async ({
    authedPage: page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    // Click previous day
    const prevBtn = page.getByRole("button", { name: "Previous day" });
    await prevBtn.click();

    await page.waitForURL((url) => url.searchParams.has("date"));
    const url = new URL(page.url());
    const dateParam = url.searchParams.get("date");
    expect(dateParam).toBeTruthy();
    expect(dateParam).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("8 — date selector Today button resets to current date", async ({
    authedPage: page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    // First navigate away from today to make the "Today" button appear
    const prevBtn = page.getByRole("button", { name: "Previous day" });
    await prevBtn.click();
    await page.waitForURL((url) => url.searchParams.has("date"));

    // The "Today" button should appear
    const todayBtn = page.getByRole("button", { name: "Today" });
    await expect(todayBtn).toBeVisible();

    // Click it
    await todayBtn.click();

    // The date param should be removed (today is the default)
    await page.waitForURL((url) => !url.searchParams.has("date"));
    const url = new URL(page.url());
    expect(url.searchParams.has("date")).toBe(false);
  });
});

// ── Cross-cutting ──────────────────────────────────────────────────────

test.describe("Cross-cutting", () => {
  test("9 — double-entry invariant holds after seeding mixed transactions", async ({
    testUser,
  }) => {
    // Seed accounts
    const checking = await seedAccount(testUser.id, { name: "Checking" });
    const savings = await seedAccount(testUser.id, { name: "Savings" });
    const groceries = await seedCategoryAccount(testUser.id, "Groceries", "expense");
    const salary = await seedCategoryAccount(testUser.id, "Salary", "income");

    // Seed an opening balance
    await seedBalance(testUser.id, checking.id, 5000);

    // Seed several expenses
    await seedExpense(testUser.id, checking.id, groceries.id, 42.5, {
      description: "Weekly groceries",
    });
    await seedExpense(testUser.id, checking.id, groceries.id, 18.99, {
      description: "Snacks",
    });

    // Seed income
    await seedIncome(testUser.id, checking.id, salary.id, 3200, {
      description: "Monthly salary",
    });

    // Seed a transfer
    await seedTransfer(testUser.id, checking.id, savings.id, 500, {
      description: "Savings transfer",
    });

    // Assert all journal lines sum to zero
    await assertDoubleEntryBalanced(testUser.id);
  });

  test("10 — currency formatting is consistent ($, commas, 2 decimals)", async ({
    authedPage: page,
    testUser,
  }) => {
    // Seed an account with a known balance that would show commas
    const account = await seedAccount(testUser.id, {
      name: "Format Test Account",
      type: "asset",
      institution: "Test Bank",
    });
    await seedBalance(testUser.id, account.id, 1234.56);

    // Navigate to accounts page
    await page.goto("/accounts");
    await page.waitForURL(/\/accounts/);

    // Look for the formatted balance on the account card specifically
    const card = page.locator('[data-slot="card"]').filter({ hasText: "Format Test Account" });
    await expect(card.locator(".text-2xl")).toContainText("$1,234.56");
  });

  test("11 — visiting /login when logged in redirects to home", async ({
    authedPage: page,
  }) => {
    await page.goto("/login");
    // Should redirect away from /login
    await page.waitForURL(
      (url) => !url.pathname.includes("/login"),
      { timeout: 10_000 },
    );
    const pathname = new URL(page.url()).pathname;
    // Root "/" redirects to "/chat", so logged-in users end up at /chat
    expect(pathname === "/" || pathname === "/chat").toBe(true);
  });

  test("12 — page titles are set correctly", async ({
    authedPage: page,
  }) => {
    const pageTitles: Record<string, string> = {
      "/dashboard": "Dashboard | Wallet",
      "/accounts": "Accounts | Wallet",
      "/expenses": "Expense Categories | Wallet",
      "/income": "Income Sources | Wallet",
      "/transactions": "Transactions | Wallet",
      "/goals": "Goals | Wallet",
      "/chat": "Chat | Wallet",
    };

    for (const [path, expectedTitle] of Object.entries(pageTitles)) {
      await page.goto(path);
      await expect(page).toHaveTitle(expectedTitle);
    }
  });

  test("13 — browser back/forward navigation preserves state", async ({
    authedPage: page,
  }) => {
    // Navigate: Dashboard -> Accounts -> Goals
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    await page.locator(`[data-slot="sidebar"] a[href*="/accounts"]`).click();
    await page.waitForURL(/\/accounts/);
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();

    await page.locator(`[data-slot="sidebar"] a[href*="/goals"]`).click();
    await page.waitForURL(/\/goals/);
    await expect(page.getByRole("heading", { name: "Goals" })).toBeVisible();

    // Go back to Accounts
    await page.goBack();
    await page.waitForURL(/\/accounts/);
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();

    // Go back to Dashboard
    await page.goBack();
    await page.waitForURL(/\/dashboard/);

    // Go forward to Accounts
    await page.goForward();
    await page.waitForURL(/\/accounts/);
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
  });

  test("14 — date parameter persists across page navigation", async ({
    authedPage: page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    // Set a date by clicking previous day
    const prevBtn = page.getByRole("button", { name: "Previous day" });
    await prevBtn.click();
    await page.waitForURL((url) => url.searchParams.has("date"));
    const dateParam = new URL(page.url()).searchParams.get("date")!;

    // Navigate to Accounts via sidebar — sidebar preserves date via withDate()
    await page.locator(`[data-slot="sidebar"] a[href*="/accounts"]`).click();
    await page.waitForURL(/\/accounts/);

    // Date param should persist
    const accountsDate = new URL(page.url()).searchParams.get("date");
    expect(accountsDate).toBe(dateParam);

    // Navigate to Expenses
    await page.locator(`[data-slot="sidebar"] a[href*="/expenses"]`).click();
    await page.waitForURL(/\/expenses/);

    const expensesDate = new URL(page.url()).searchParams.get("date");
    expect(expensesDate).toBe(dateParam);
  });

  test("15 — responsive: sidebar collapses on small viewport", async ({
    authedPage: page,
  }) => {
    // Start at desktop size — sidebar should be visible
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    // On desktop, the sidebar element (with data-state) should be visible
    const desktopSidebar = page.locator('[data-slot="sidebar"]:not([data-mobile="true"])');
    await expect(desktopSidebar).toBeVisible();

    // Resize to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // The desktop sidebar (hidden below md breakpoint via "hidden md:block") should no longer be visible
    await expect(desktopSidebar).toBeHidden();

    // The sidebar trigger should still be visible on mobile
    const trigger = page.locator('[data-sidebar="trigger"]');
    await expect(trigger).toBeVisible();

    // Clicking the trigger on mobile should open the sidebar as a sheet
    await trigger.click();

    // The mobile sidebar sheet should appear (has data-mobile="true")
    const mobileSidebar = page.locator('[data-slot="sidebar"][data-mobile="true"]');
    await expect(mobileSidebar).toBeVisible();

    // Nav items should be visible inside the mobile sidebar
    await expect(mobileSidebar.getByText("Dashboard")).toBeVisible();
    await expect(mobileSidebar.getByText("Accounts")).toBeVisible();
  });

  test("16 — multiple financial operations maintain double-entry balance", async ({
    testUser,
  }) => {
    // Set up accounts
    const checking = await seedAccount(testUser.id, { name: "Primary Checking" });
    const savings = await seedAccount(testUser.id, { name: "High-Yield Savings" });
    const creditCard = await seedAccount(testUser.id, {
      name: "Credit Card",
      type: "liability",
    });

    const rent = await seedCategoryAccount(testUser.id, "Rent", "expense");
    const food = await seedCategoryAccount(testUser.id, "Food", "expense");
    const utilities = await seedCategoryAccount(testUser.id, "Utilities", "expense");
    const salary = await seedCategoryAccount(testUser.id, "Salary", "income");
    const freelance = await seedCategoryAccount(testUser.id, "Freelance", "income");

    // Opening balances
    await seedBalance(testUser.id, checking.id, 10000);
    await seedBalance(testUser.id, savings.id, 25000);
    await seedBalance(testUser.id, creditCard.id, -1500); // liability

    // Multiple expenses
    await seedExpense(testUser.id, checking.id, rent.id, 1200, {
      description: "April rent",
    });
    await seedExpense(testUser.id, checking.id, food.id, 87.43, {
      description: "Grocery run",
    });
    await seedExpense(testUser.id, checking.id, utilities.id, 145.67, {
      description: "Electric bill",
    });
    await seedExpense(testUser.id, creditCard.id, food.id, 32.5, {
      description: "Restaurant",
    });

    // Multiple incomes
    await seedIncome(testUser.id, checking.id, salary.id, 4500, {
      description: "Monthly salary",
    });
    await seedIncome(testUser.id, checking.id, freelance.id, 750, {
      description: "Contract payment",
    });

    // Transfers
    await seedTransfer(testUser.id, checking.id, savings.id, 2000, {
      description: "Monthly savings",
    });
    await seedTransfer(testUser.id, checking.id, creditCard.id, 500, {
      description: "CC payment",
    });

    // Verify double-entry invariant
    await assertDoubleEntryBalanced(testUser.id);

    // Verify individual account balances make sense
    const checkingBalance = await getAccountBalanceRaw(checking.id);
    // 10000 - 1200 - 87.43 - 145.67 + 4500 + 750 - 2000 - 500 = 11316.90
    expect(checkingBalance).toBe(BigInt(1131690));

    const savingsBalance = await getAccountBalanceRaw(savings.id);
    // 25000 + 2000 = 27000
    expect(savingsBalance).toBe(BigInt(2700000));
  });
});
