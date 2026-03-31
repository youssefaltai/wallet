import { test, expect } from "../../fixtures/auth";
import {
  seedAccount,
  seedCategoryAccount,
  seedExpense,
  seedIncome,
  seedTransfer,
} from "../../fixtures/db-helpers";

// All seeded dates are within March 2026 (the current month) so they appear
// on the default transactions page, unless a test deliberately uses dates
// outside that range.

const THIS_MONTH = "2026-03";

/**
 * Helper: navigate to the transactions page and wait for the heading.
 * Accepts optional search params.
 */
async function goToTransactions(
  page: import("@playwright/test").Page,
  params?: Record<string, string>,
) {
  const sp = new URLSearchParams(params);
  const qs = sp.toString();
  await page.goto(`/transactions${qs ? `?${qs}` : ""}`);
  await page.getByRole("heading", { name: "Transactions" }).waitFor();
}

// ═══════════════════════════════════════════════════════════════════════
// 1. Empty state
// ═══════════════════════════════════════════════════════════════════════
test("1 — empty state shows no-transactions message", async ({
  authedPage: page,
}) => {
  await goToTransactions(page);
  await expect(
    page.getByText("No transactions for this period."),
  ).toBeVisible();
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Expense displays correctly
// ═══════════════════════════════════════════════════════════════════════
test("2 — expense transaction displays correctly", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const groceries = await seedCategoryAccount(
    testUser.id,
    "Groceries",
    "expense",
  );
  await seedExpense(testUser.id, checking.id, groceries.id, 52.3, {
    date: `${THIS_MONTH}-15`,
    description: "Weekly groceries",
  });

  await goToTransactions(page);

  const row = page.getByRole("row").filter({ hasText: "Weekly groceries" });
  await expect(row).toBeVisible();
  await expect(row.locator("[data-slot='badge']", { hasText: "Groceries" })).toBeVisible();
  await expect(row.getByText("Checking")).toBeVisible();
  // Expense amounts are signed negative: -$52.30
  await expect(row.getByText(/\-?\$52\.30/)).toBeVisible();
});

// ═══════════════════════════════════════════════════════════════════════
// 3. Income displays correctly
// ═══════════════════════════════════════════════════════════════════════
test("3 — income transaction displays correctly", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const salary = await seedCategoryAccount(testUser.id, "Salary", "income");
  await seedIncome(testUser.id, checking.id, salary.id, 3500, {
    date: `${THIS_MONTH}-01`,
    description: "March paycheck",
  });

  await goToTransactions(page);

  const row = page.getByRole("row").filter({ hasText: "March paycheck" });
  await expect(row).toBeVisible();
  await expect(row.getByText("Salary")).toBeVisible();
  await expect(row.getByText("Checking")).toBeVisible();
  await expect(row.getByText(/\$3,500\.00/)).toBeVisible();
});

// ═══════════════════════════════════════════════════════════════════════
// 4. Transfer displays correctly
// ═══════════════════════════════════════════════════════════════════════
test("4 — transfer transaction displays correctly", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const savings = await seedAccount(testUser.id, { name: "Savings" });
  await seedTransfer(testUser.id, checking.id, savings.id, 200, {
    date: `${THIS_MONTH}-10`,
    description: "Move to savings",
  });

  await goToTransactions(page);

  const row = page.getByRole("row").filter({ hasText: "Move to savings" });
  await expect(row).toBeVisible();
  // Transfer type shown as a Badge
  await expect(row.getByText("Transfer")).toBeVisible();
  // Transfer shows "AccountA → AccountB" in the account cell
  await expect(row.getByText(/Checking → Savings/)).toBeVisible();
  await expect(row.getByText(/\$200\.00/)).toBeVisible();
});

// ═══════════════════════════════════════════════════════════════════════
// 5. Multiple transactions sorted newest-first
// ═══════════════════════════════════════════════════════════════════════
test("5 — multiple transactions sorted by date newest first", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const food = await seedCategoryAccount(testUser.id, "Food", "expense");

  await seedExpense(testUser.id, checking.id, food.id, 10, {
    date: `${THIS_MONTH}-05`,
    description: "Older expense",
  });
  await seedExpense(testUser.id, checking.id, food.id, 20, {
    date: `${THIS_MONTH}-20`,
    description: "Newer expense",
  });
  await seedExpense(testUser.id, checking.id, food.id, 15, {
    date: `${THIS_MONTH}-12`,
    description: "Middle expense",
  });

  await goToTransactions(page);

  const rows = page.getByRole("row");
  // header row + 3 data rows = 4 total
  await expect(rows).toHaveCount(4);

  // Extract descriptions in order (2nd column = Description)
  const descriptions = await page
    .locator("table tbody tr td:nth-child(2)")
    .allTextContents();
  expect(descriptions).toEqual([
    "Newer expense",
    "Middle expense",
    "Older expense",
  ]);
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Filter by account
// ═══════════════════════════════════════════════════════════════════════
test("6 — filter by account shows only matching transactions", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const savings = await seedAccount(testUser.id, { name: "Savings" });
  const food = await seedCategoryAccount(testUser.id, "Food", "expense");

  await seedExpense(testUser.id, checking.id, food.id, 25, {
    date: `${THIS_MONTH}-10`,
    description: "Checking food",
  });
  await seedExpense(testUser.id, savings.id, food.id, 30, {
    date: `${THIS_MONTH}-11`,
    description: "Savings food",
  });

  await goToTransactions(page, { account: checking.id });

  await expect(
    page.getByRole("row").filter({ hasText: "Checking food" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Savings food" }),
  ).not.toBeVisible();
});

// ═══════════════════════════════════════════════════════════════════════
// 7. Filter by category
// ═══════════════════════════════════════════════════════════════════════
test("7 — filter by category shows only matching transactions", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const groceries = await seedCategoryAccount(
    testUser.id,
    "Groceries",
    "expense",
  );
  const transport = await seedCategoryAccount(
    testUser.id,
    "Transport",
    "expense",
  );

  await seedExpense(testUser.id, checking.id, groceries.id, 40, {
    date: `${THIS_MONTH}-08`,
    description: "Grocery run",
  });
  await seedExpense(testUser.id, checking.id, transport.id, 15, {
    date: `${THIS_MONTH}-09`,
    description: "Bus ticket",
  });

  await goToTransactions(page, { category: groceries.id });

  await expect(
    page.getByRole("row").filter({ hasText: "Grocery run" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Bus ticket" }),
  ).not.toBeVisible();
});

// ═══════════════════════════════════════════════════════════════════════
// 8. Filter by type — expense only
// ═══════════════════════════════════════════════════════════════════════
test("8 — filter by type expense shows only expenses", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const food = await seedCategoryAccount(testUser.id, "Food", "expense");
  const salary = await seedCategoryAccount(testUser.id, "Salary", "income");

  await seedExpense(testUser.id, checking.id, food.id, 20, {
    date: `${THIS_MONTH}-05`,
    description: "Lunch",
  });
  await seedIncome(testUser.id, checking.id, salary.id, 1000, {
    date: `${THIS_MONTH}-01`,
    description: "Pay",
  });

  await goToTransactions(page, { type: "expense" });

  await expect(
    page.getByRole("row").filter({ hasText: "Lunch" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Pay" }),
  ).not.toBeVisible();
});

// ═══════════════════════════════════════════════════════════════════════
// 9. Filter by type — income only
// ═══════════════════════════════════════════════════════════════════════
test("9 — filter by type income shows only income", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const food = await seedCategoryAccount(testUser.id, "Food", "expense");
  const salary = await seedCategoryAccount(testUser.id, "Salary", "income");

  await seedExpense(testUser.id, checking.id, food.id, 20, {
    date: `${THIS_MONTH}-05`,
    description: "Dinner",
  });
  await seedIncome(testUser.id, checking.id, salary.id, 2000, {
    date: `${THIS_MONTH}-01`,
    description: "Paycheck",
  });

  await goToTransactions(page, { type: "income" });

  await expect(
    page.getByRole("row").filter({ hasText: "Paycheck" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Dinner" }),
  ).not.toBeVisible();
});

// ═══════════════════════════════════════════════════════════════════════
// 10. Filter by type — transfer only
// ═══════════════════════════════════════════════════════════════════════
test("10 — filter by type transfer shows only transfers", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const savings = await seedAccount(testUser.id, { name: "Savings" });
  const food = await seedCategoryAccount(testUser.id, "Food", "expense");

  await seedExpense(testUser.id, checking.id, food.id, 20, {
    date: `${THIS_MONTH}-05`,
    description: "Snack",
  });
  await seedTransfer(testUser.id, checking.id, savings.id, 100, {
    date: `${THIS_MONTH}-06`,
    description: "Savings xfer",
  });

  await goToTransactions(page, { type: "transfer" });

  await expect(
    page.getByRole("row").filter({ hasText: "Savings xfer" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Snack" }),
  ).not.toBeVisible();
});

// ═══════════════════════════════════════════════════════════════════════
// 11. Search by description text
// ═══════════════════════════════════════════════════════════════════════
test("11 — search by description filters results", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const food = await seedCategoryAccount(testUser.id, "Food", "expense");

  await seedExpense(testUser.id, checking.id, food.id, 12, {
    date: `${THIS_MONTH}-10`,
    description: "Coffee shop",
  });
  await seedExpense(testUser.id, checking.id, food.id, 45, {
    date: `${THIS_MONTH}-11`,
    description: "Restaurant dinner",
  });

  await goToTransactions(page, { q: "Coffee" });

  await expect(
    page.getByRole("row").filter({ hasText: "Coffee shop" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Restaurant dinner" }),
  ).not.toBeVisible();
});

// ═══════════════════════════════════════════════════════════════════════
// 12. Combined filters — account + type
// ═══════════════════════════════════════════════════════════════════════
test("12 — combined filters (account + type) narrow results", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const savings = await seedAccount(testUser.id, { name: "Savings" });
  const food = await seedCategoryAccount(testUser.id, "Food", "expense");
  const salary = await seedCategoryAccount(testUser.id, "Salary", "income");

  // Expense on checking
  await seedExpense(testUser.id, checking.id, food.id, 30, {
    date: `${THIS_MONTH}-05`,
    description: "Checking expense",
  });
  // Income on checking
  await seedIncome(testUser.id, checking.id, salary.id, 500, {
    date: `${THIS_MONTH}-06`,
    description: "Checking income",
  });
  // Expense on savings
  await seedExpense(testUser.id, savings.id, food.id, 10, {
    date: `${THIS_MONTH}-07`,
    description: "Savings expense",
  });

  // Filter: type=expense AND account=checking
  await goToTransactions(page, {
    type: "expense",
    account: checking.id,
  });

  await expect(
    page.getByRole("row").filter({ hasText: "Checking expense" }),
  ).toBeVisible();
  // Income on checking should be hidden (wrong type)
  await expect(
    page.getByRole("row").filter({ hasText: "Checking income" }),
  ).not.toBeVisible();
  // Expense on savings should be hidden (wrong account)
  await expect(
    page.getByRole("row").filter({ hasText: "Savings expense" }),
  ).not.toBeVisible();
});

// ═══════════════════════════════════════════════════════════════════════
// 13. Date range filtering
// ═══════════════════════════════════════════════════════════════════════
test("13 — date range filtering excludes out-of-range transactions", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const food = await seedCategoryAccount(testUser.id, "Food", "expense");

  await seedExpense(testUser.id, checking.id, food.id, 10, {
    date: `${THIS_MONTH}-05`,
    description: "Early March",
  });
  await seedExpense(testUser.id, checking.id, food.id, 20, {
    date: `${THIS_MONTH}-15`,
    description: "Mid March",
  });
  await seedExpense(testUser.id, checking.id, food.id, 30, {
    date: `${THIS_MONTH}-25`,
    description: "Late March",
  });

  // Only show March 10-20
  await goToTransactions(page, {
    from: `${THIS_MONTH}-10`,
    to: `${THIS_MONTH}-20`,
  });

  await expect(
    page.getByRole("row").filter({ hasText: "Mid March" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Early March" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Late March" }),
  ).not.toBeVisible();
});

// ═══════════════════════════════════════════════════════════════════════
// 14. Pagination — more than 20 txns shows pagination controls
// ═══════════════════════════════════════════════════════════════════════
test("14 — pagination controls appear when more than 20 transactions", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const food = await seedCategoryAccount(testUser.id, "Food", "expense");

  // Seed 25 transactions
  const promises = [];
  for (let i = 1; i <= 25; i++) {
    const day = String(i).padStart(2, "0");
    promises.push(
      seedExpense(testUser.id, checking.id, food.id, i, {
        date: `${THIS_MONTH}-${day}`,
        description: `Expense ${i}`,
      }),
    );
  }
  await Promise.all(promises);

  await goToTransactions(page);

  // Pagination nav should be visible with page info
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  // Next page button should be enabled (inside an anchor link)
  await expect(
    page.locator('a').filter({ has: page.getByRole("button", { name: "Next page" }) }),
  ).toBeVisible();
  // Should show exactly 20 data rows
  const dataRows = page.locator("table tbody tr");
  await expect(dataRows).toHaveCount(20);
});

// ═══════════════════════════════════════════════════════════════════════
// 15. Pagination — clicking Next shows next page
// ═══════════════════════════════════════════════════════════════════════
test("15 — clicking Next page shows second page of results", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const food = await seedCategoryAccount(testUser.id, "Food", "expense");

  const promises = [];
  for (let i = 1; i <= 25; i++) {
    const day = String(i).padStart(2, "0");
    promises.push(
      seedExpense(testUser.id, checking.id, food.id, i, {
        date: `${THIS_MONTH}-${day}`,
        description: `Item ${String(i).padStart(2, "0")}`,
      }),
    );
  }
  await Promise.all(promises);

  await goToTransactions(page);
  await expect(page.getByText("Page 1 of 2")).toBeVisible();

  // Click the anchor link wrapping the Next page button
  await page
    .locator("a")
    .filter({ has: page.getByRole("button", { name: "Next page" }) })
    .click();

  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  // Second page should have the remaining 5 rows
  const dataRows = page.locator("table tbody tr");
  await expect(dataRows).toHaveCount(5);
});

// ═══════════════════════════════════════════════════════════════════════
// 16. Pagination — clicking Previous goes back
// ═══════════════════════════════════════════════════════════════════════
test("16 — clicking Previous page returns to first page", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const food = await seedCategoryAccount(testUser.id, "Food", "expense");

  const promises = [];
  for (let i = 1; i <= 25; i++) {
    const day = String(i).padStart(2, "0");
    promises.push(
      seedExpense(testUser.id, checking.id, food.id, i, {
        date: `${THIS_MONTH}-${day}`,
        description: `Entry ${String(i).padStart(2, "0")}`,
      }),
    );
  }
  await Promise.all(promises);

  // Start on page 2
  await goToTransactions(page, { page: "2" });
  await expect(page.getByText("Page 2 of 2")).toBeVisible();

  // Click the anchor link wrapping the Previous page button
  await page
    .locator("a")
    .filter({ has: page.getByRole("button", { name: "Previous page" }) })
    .click();

  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  const dataRows = page.locator("table tbody tr");
  await expect(dataRows).toHaveCount(20);
});

// ═══════════════════════════════════════════════════════════════════════
// 17. Amount formatting — currency symbol, commas, decimals
// ═══════════════════════════════════════════════════════════════════════
test("17 — amount formatting includes currency symbol, commas, and decimals", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const salary = await seedCategoryAccount(testUser.id, "Salary", "income");

  // Large amount that needs comma formatting
  await seedIncome(testUser.id, checking.id, salary.id, 12345.67, {
    date: `${THIS_MONTH}-15`,
    description: "Big paycheck",
  });

  await goToTransactions(page);

  const row = page.getByRole("row").filter({ hasText: "Big paycheck" });
  // Income is formatted as $12,345.67 (no negative sign)
  await expect(row.getByText("$12,345.67")).toBeVisible();
});

// ═══════════════════════════════════════════════════════════════════════
// 18. Transaction with notes displays notes via edit dialog
// ═══════════════════════════════════════════════════════════════════════
test("18 — transaction with notes displays the notes", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const food = await seedCategoryAccount(testUser.id, "Food", "expense");

  await seedExpense(testUser.id, checking.id, food.id, 25, {
    date: `${THIS_MONTH}-10`,
    description: "Business lunch",
    notes: "Client meeting at Italian place",
  });

  await goToTransactions(page);

  // The transaction row should be present
  const row = page.getByRole("row").filter({ hasText: "Business lunch" });
  await expect(row).toBeVisible();

  // Open context menu on the row to access Edit
  await row.click({ button: "right" });
  await page.getByText("Edit Transaction").click();

  // The edit dialog has a notes textarea with defaultValue containing the notes.
  // Textarea values are not found by getByText; check the input value instead.
  const notesTextarea = page.locator('textarea[name="notes"]');
  await expect(notesTextarea).toHaveValue("Client meeting at Italian place");
});

// ═══════════════════════════════════════════════════════════════════════
// 19. Empty filter results — "No transactions found" message
// ═══════════════════════════════════════════════════════════════════════
test("19 — empty filter results show no-transactions message", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const food = await seedCategoryAccount(testUser.id, "Food", "expense");

  await seedExpense(testUser.id, checking.id, food.id, 20, {
    date: `${THIS_MONTH}-10`,
    description: "Some expense",
  });

  // Search for something that does not exist
  await goToTransactions(page, { q: "NONEXISTENT_QUERY_12345" });

  await expect(
    page.getByText("No transactions for this period."),
  ).toBeVisible();
});

// ═══════════════════════════════════════════════════════════════════════
// 20. Filters preserved in URL on reload
// ═══════════════════════════════════════════════════════════════════════
test("20 — filters are preserved in URL across page reload", async ({
  testUser,
  authedPage: page,
}) => {
  const checking = await seedAccount(testUser.id, { name: "Checking" });
  const food = await seedCategoryAccount(testUser.id, "Food", "expense");

  await seedExpense(testUser.id, checking.id, food.id, 50, {
    date: `${THIS_MONTH}-10`,
    description: "Filtered expense",
  });

  // Navigate with multiple filters
  await goToTransactions(page, {
    type: "expense",
    q: "Filtered",
    account: checking.id,
  });

  // Verify the transaction is visible
  await expect(
    page.getByRole("row").filter({ hasText: "Filtered expense" }),
  ).toBeVisible();

  // Verify URL contains the filter params
  const url = new URL(page.url());
  expect(url.searchParams.get("type")).toBe("expense");
  expect(url.searchParams.get("q")).toBe("Filtered");
  expect(url.searchParams.get("account")).toBe(checking.id);

  // Reload the page
  await page.reload();
  await page.getByRole("heading", { name: "Transactions" }).waitFor();

  // Verify filters are still applied after reload
  const reloadedUrl = new URL(page.url());
  expect(reloadedUrl.searchParams.get("type")).toBe("expense");
  expect(reloadedUrl.searchParams.get("q")).toBe("Filtered");
  expect(reloadedUrl.searchParams.get("account")).toBe(checking.id);

  // Verify the filtered transaction is still visible
  await expect(
    page.getByRole("row").filter({ hasText: "Filtered expense" }),
  ).toBeVisible();
});
