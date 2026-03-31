import { test, expect } from "../../fixtures/auth";
import { seedAccount, seedBalance, seedCategoryAccount, seedExpense } from "../../fixtures/db-helpers";
import { db } from "../../fixtures/auth";
import { accounts } from "../../../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { seedGoal, seedIncome, seedJournalEntry } from "../../fixtures/db-helpers";

// ---------------------------------------------------------------------------
// Accounts list page E2E tests
// ---------------------------------------------------------------------------

test.describe("Accounts page", () => {
  // 1. Empty state
  test("shows empty state message when no accounts exist", async ({
    authedPage,
  }) => {
    await authedPage.goto("/accounts");

    await expect(authedPage.getByText("No accounts yet. Add your first account to get started.")).toBeVisible();
  });

  // 2. Asset accounts display with correct balances
  test("displays asset accounts with correct balances", async ({
    authedPage,
    testUser,
  }) => {
    const checking = await seedAccount(testUser.id, {
      name: "Checking Account",
      type: "asset",
      institution: "Chase",
    });
    await seedBalance(testUser.id, checking.id, 1500.75);

    const savings = await seedAccount(testUser.id, {
      name: "Savings Account",
      type: "asset",
      institution: "Ally",
    });
    await seedBalance(testUser.id, savings.id, 5000);

    await authedPage.goto("/accounts");

    // Section heading for assets
    await expect(authedPage.getByText("Bank & Cash")).toBeVisible();

    // Scope balance assertions to each account's card to avoid strict mode violations
    const checkingCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "Checking Account" });
    await expect(checkingCard).toBeVisible();
    await expect(checkingCard.locator(".text-2xl")).toContainText("$1,500.75");

    const savingsCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "Savings Account" });
    await expect(savingsCard).toBeVisible();
    await expect(savingsCard.locator(".text-2xl")).toContainText("$5,000.00");
  });

  // 3. Liability accounts display with correct balances (positive display value)
  test("displays liability accounts with positive display values", async ({
    authedPage,
    testUser,
  }) => {
    const creditCard = await seedAccount(testUser.id, {
      name: "Visa Card",
      type: "liability",
      institution: "Capital One",
    });
    // For liabilities, a credit (negative journal line) represents owing money.
    // seedBalance debits the account. For a liability, owing $2000 means the
    // account has a credit balance. We seed a negative amount to create that
    // credit balance, which displays as positive on the UI.
    await seedJournalEntry(testUser.id, {
      date: new Date().toISOString().slice(0, 10),
      description: "Credit card balance",
      lines: [
        { accountId: creditCard.id, amount: -200000n }, // credit liability = owe $2000
        {
          accountId: (
            await seedAccount(testUser.id, {
              name: "Equity Placeholder",
              type: "asset",
            })
          ).id,
          amount: 200000n,
        },
      ],
    });

    await authedPage.goto("/accounts");

    // Section heading for liabilities
    await expect(authedPage.getByText("Credit & Loans")).toBeVisible();

    // Scope to the Visa Card to avoid matching the total balance as well
    const visaCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "Visa Card" });
    await expect(visaCard).toBeVisible();
    // Liability with credit balance of -200000 minor units:
    // displayBalance = -rawBalance = -(-200000) = 200000 = $2,000.00
    await expect(visaCard.locator(".text-2xl")).toContainText("$2,000.00");
  });

  // 4. Account institution is displayed
  test("displays account institution", async ({ authedPage, testUser }) => {
    await seedAccount(testUser.id, {
      name: "Main Checking",
      type: "asset",
      institution: "Wells Fargo",
    });

    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Main Checking" });
    await expect(card).toBeVisible();
    await expect(card.getByText("Wells Fargo")).toBeVisible();
  });

  // 5. Multiple accounts sorted by name
  test("shows multiple accounts sorted alphabetically by name", async ({
    authedPage,
    testUser,
  }) => {
    await seedAccount(testUser.id, {
      name: "Zebra Account",
      type: "asset",
      institution: "Bank Z",
    });
    await seedAccount(testUser.id, {
      name: "Alpha Account",
      type: "asset",
      institution: "Bank A",
    });
    await seedAccount(testUser.id, {
      name: "Middle Account",
      type: "asset",
      institution: "Bank M",
    });

    await authedPage.goto("/accounts");

    const cards = authedPage.locator('[data-slot="card"]').filter({ hasText: /Account/ });
    const names = await cards.allTextContents();
    const joinedText = names.join(" ");

    // Alpha should appear before Middle, and Middle before Zebra
    const alphaIdx = joinedText.indexOf("Alpha Account");
    const middleIdx = joinedText.indexOf("Middle Account");
    const zebraIdx = joinedText.indexOf("Zebra Account");

    expect(alphaIdx).toBeLessThan(middleIdx);
    expect(middleIdx).toBeLessThan(zebraIdx);
  });

  // 6. Balance computed correctly from multiple transactions
  test("computes balance correctly from multiple transactions", async ({
    authedPage,
    testUser,
  }) => {
    const account = await seedAccount(testUser.id, {
      name: "Transaction Test",
      type: "asset",
    });

    // Seed opening balance of $1000
    await seedBalance(testUser.id, account.id, 1000);

    // Seed an expense of $250 (credits asset, debits expense category)
    const groceries = await seedCategoryAccount(testUser.id, "Groceries", "expense");
    await seedExpense(testUser.id, account.id, groceries.id, 250);

    // Seed income of $500 (debits asset, credits income category)
    const salary = await seedCategoryAccount(testUser.id, "Salary", "income");
    await seedIncome(testUser.id, account.id, salary.id, 500);

    // Expected: 1000 - 250 + 500 = $1,250.00
    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Transaction Test" });
    await expect(card).toBeVisible();
    await expect(card.locator(".text-2xl")).toContainText("$1,250.00");
  });

  // 7. Goal backing accounts are hidden from the list
  test("hides goal-backing accounts from the list", async ({
    authedPage,
    testUser,
  }) => {
    // Create a normal visible account
    const visible = await seedAccount(testUser.id, {
      name: "Visible Checking",
      type: "asset",
      institution: "Chase",
    });
    await seedBalance(testUser.id, visible.id, 500);

    // Create a goal (which creates a hidden backing account named "Goal: Vacation Fund")
    await seedGoal(testUser.id, {
      name: "Vacation Fund",
      targetAmount: 5000,
      fundFromAccountId: visible.id,
      fundAmount: 200,
    });

    await authedPage.goto("/accounts");

    // The normal account should be visible
    await expect(authedPage.getByText("Visible Checking")).toBeVisible();

    // The goal-backing account should NOT be visible
    await expect(authedPage.getByText("Goal: Vacation Fund")).not.toBeVisible();
  });

  // 8. Inactive accounts still display (but may be visually distinct)
  test("displays inactive accounts with an Inactive badge", async ({
    authedPage,
    testUser,
  }) => {
    const account = await seedAccount(testUser.id, {
      name: "Old Savings",
      type: "asset",
      institution: "Defunct Bank",
    });

    // Mark the account as inactive directly in the DB
    await db
      .update(accounts)
      .set({ isActive: false })
      .where(eq(accounts.id, account.id));

    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Old Savings" });
    await expect(card).toBeVisible();
    await expect(card.getByText("Inactive")).toBeVisible();
  });

  // 9. Zero balance account displays $0.00
  test("displays $0.00 for an account with zero balance", async ({
    authedPage,
    testUser,
  }) => {
    await seedAccount(testUser.id, {
      name: "Empty Account",
      type: "asset",
      institution: "Test Bank",
    });

    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Empty Account" });
    await expect(card).toBeVisible();
    await expect(card.locator(".text-2xl")).toContainText("$0.00");
  });

  // 10. Large balance displays correctly with commas
  test("displays large balances with proper comma formatting", async ({
    authedPage,
    testUser,
  }) => {
    const account = await seedAccount(testUser.id, {
      name: "Investment Account",
      type: "asset",
      institution: "Vanguard",
    });
    await seedBalance(testUser.id, account.id, 1000000);

    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Investment Account" });
    await expect(card).toBeVisible();
    await expect(card.locator(".text-2xl")).toContainText("$1,000,000.00");
  });

  // 11. Account with no institution shows gracefully
  test("shows account gracefully when institution is not set", async ({
    authedPage,
    testUser,
  }) => {
    await seedAccount(testUser.id, {
      name: "Cash Stash",
      type: "asset",
    });

    await authedPage.goto("/accounts");

    const card = authedPage.locator('[data-slot="card"]').filter({ hasText: "Cash Stash" });
    await expect(card).toBeVisible();
    await expect(card.locator(".text-2xl")).toContainText("$0.00");

    // The institution paragraph has class "text-xs text-muted-foreground mt-1".
    // With no institution set, this element should not exist.
    const institutionEl = card.locator("[data-slot='card-content'] p.mt-1");
    await expect(institutionEl).toHaveCount(0);
  });

  // 12. Navigation from dashboard "View all" link
  test("navigates to accounts page from dashboard View all link", async ({
    authedPage,
    testUser,
  }) => {
    // Seed an account so the dashboard accounts section shows content
    const account = await seedAccount(testUser.id, {
      name: "Nav Test Account",
      type: "asset",
      institution: "Test Bank",
    });
    await seedBalance(testUser.id, account.id, 100);

    // Start at the dashboard
    await authedPage.goto("/dashboard");
    await expect(authedPage.locator("h1", { hasText: "Dashboard" })).toBeVisible();

    // Find the "View all" link next to the Accounts heading
    const viewAllLink = authedPage.locator("h2", { hasText: "Accounts" }).locator("..").getByRole("link", { name: "View all" });
    await viewAllLink.click();

    // Should navigate to /accounts
    await authedPage.waitForURL("**/accounts");
    await expect(authedPage.getByRole("heading", { name: "Accounts", level: 1 })).toBeVisible();
  });
});
