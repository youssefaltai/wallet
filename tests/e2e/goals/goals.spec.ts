import { test, expect } from "../../fixtures/auth";
import { seedAccount, seedGoal, seedBalance } from "../../fixtures/db-helpers";

test.describe("Goals", () => {
  // ── 1. Empty state ────────────────────────────────────────────────────

  test("empty state shows appropriate message when no goals exist", async ({
    authedPage,
  }) => {
    await authedPage.goto("/goals");
    await expect(
      authedPage.getByText("No goals for this period."),
    ).toBeVisible();
  });

  // ── 2. Goal displays with correct name and target amount ──────────────

  test("goal displays with correct name and target amount", async ({
    authedPage,
    testUser,
  }) => {
    await seedGoal(testUser.id, {
      name: "Emergency Fund",
      targetAmount: 5000,
    });

    await authedPage.goto("/goals");
    const goalCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "Emergency Fund" });
    await expect(goalCard.locator('[data-slot="card-title"]')).toContainText("Emergency Fund");
    await expect(goalCard.locator(".text-sm.text-muted-foreground", { hasText: "of" })).toContainText("of $5,000.00");
  });

  // ── 3. Goal progress shows correct percentage ─────────────────────────

  test("goal progress shows correct percentage (funded / target)", async ({
    authedPage,
    testUser,
  }) => {
    const account = await seedAccount(testUser.id, {
      name: "Checking",
      type: "asset",
    });
    await seedBalance(testUser.id, account.id, 10000);

    await seedGoal(testUser.id, {
      name: "Vacation Fund",
      targetAmount: 2000,
      fundFromAccountId: account.id,
      fundAmount: 500,
    });

    await authedPage.goto("/goals");
    const goalCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "Vacation Fund" });
    // 500 / 2000 = 25%
    await expect(goalCard.locator(".text-xs.text-muted-foreground.text-right")).toContainText("25%");
  });

  // ── 4. Goal with 0% progress (no funding) ─────────────────────────────

  test("goal with 0% progress shows 0%", async ({
    authedPage,
    testUser,
  }) => {
    await seedGoal(testUser.id, {
      name: "New Car",
      targetAmount: 25000,
    });

    await authedPage.goto("/goals");
    const goalCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "New Car" });
    await expect(goalCard.locator(".text-2xl")).toContainText("$0.00");
    await expect(goalCard.locator(".text-xs.text-muted-foreground.text-right")).toContainText("0%");
  });

  // ── 5. Goal with partial progress ─────────────────────────────────────

  test("goal with partial progress ($500 of $1,000) shows 50%", async ({
    authedPage,
    testUser,
  }) => {
    const account = await seedAccount(testUser.id, {
      name: "Savings",
      type: "asset",
    });
    await seedBalance(testUser.id, account.id, 5000);

    await seedGoal(testUser.id, {
      name: "Laptop Fund",
      targetAmount: 1000,
      fundFromAccountId: account.id,
      fundAmount: 500,
    });

    await authedPage.goto("/goals");
    const goalCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "Laptop Fund" });
    await expect(goalCard.locator(".text-2xl")).toContainText("$500.00");
    await expect(goalCard.locator(".text-sm.text-muted-foreground", { hasText: "of" })).toContainText("of $1,000.00");
    await expect(goalCard.locator(".text-xs.text-muted-foreground.text-right")).toContainText("50%");
  });

  // ── 6. Goal with 100% progress (fully funded) ─────────────────────────

  test("goal with 100% progress shows 100%", async ({
    authedPage,
    testUser,
  }) => {
    const account = await seedAccount(testUser.id, {
      name: "Main Account",
      type: "asset",
    });
    await seedBalance(testUser.id, account.id, 10000);

    await seedGoal(testUser.id, {
      name: "Weekend Trip",
      targetAmount: 500,
      fundFromAccountId: account.id,
      fundAmount: 500,
    });

    await authedPage.goto("/goals");
    const goalCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "Weekend Trip" });
    await expect(goalCard.locator(".text-2xl")).toContainText("$500.00");
    await expect(goalCard.locator(".text-sm.text-muted-foreground", { hasText: "of" })).toContainText("of $500.00");
    await expect(goalCard.locator(".text-xs.text-muted-foreground.text-right")).toContainText("100%");
  });

  // ── 7. Goal with deadline displays the deadline date ──────────────────

  test("goal with deadline displays the deadline date", async ({
    authedPage,
    testUser,
  }) => {
    await seedGoal(testUser.id, {
      name: "House Down Payment",
      targetAmount: 50000,
      deadline: "2027-06-15",
    });

    await authedPage.goto("/goals");
    const goalCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "House Down Payment" });
    await expect(goalCard.locator(".text-xs", { hasText: "Deadline" })).toContainText("June 15, 2027");
  });

  // ── 8. Goal without deadline doesn't show deadline ────────────────────

  test("goal without deadline does not show deadline label", async ({
    authedPage,
    testUser,
  }) => {
    await seedGoal(testUser.id, {
      name: "Rainy Day Fund",
      targetAmount: 3000,
    });

    await authedPage.goto("/goals");
    const goalCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "Rainy Day Fund" });
    await expect(goalCard.locator('[data-slot="card-title"]')).toContainText("Rainy Day Fund");
    // The "Deadline:" label should not appear within this card
    await expect(goalCard.locator(".text-xs", { hasText: "Deadline" })).not.toBeVisible();
  });

  // ── 9. Multiple goals display in list ─────────────────────────────────

  test("multiple goals display in list", async ({
    authedPage,
    testUser,
  }) => {
    await seedGoal(testUser.id, { name: "Goal Alpha", targetAmount: 1000 });
    await seedGoal(testUser.id, { name: "Goal Beta", targetAmount: 2000 });
    await seedGoal(testUser.id, { name: "Goal Gamma", targetAmount: 3000 });

    await authedPage.goto("/goals");
    await expect(authedPage.locator('[data-slot="card"]').filter({ hasText: "Goal Alpha" })).toBeVisible();
    await expect(authedPage.locator('[data-slot="card"]').filter({ hasText: "Goal Beta" })).toBeVisible();
    await expect(authedPage.locator('[data-slot="card"]').filter({ hasText: "Goal Gamma" })).toBeVisible();
    // Count in the summary paragraph
    await expect(authedPage.locator("p.text-muted-foreground", { hasText: "3 goals" })).toBeVisible();
  });

  // ── 10. Progress bar visual accuracy (width matches percentage) ───────

  test("progress bar width matches the percentage", async ({
    authedPage,
    testUser,
  }) => {
    const account = await seedAccount(testUser.id, {
      name: "Checking",
      type: "asset",
    });
    await seedBalance(testUser.id, account.id, 10000);

    await seedGoal(testUser.id, {
      name: "Progress Test",
      targetAmount: 400,
      fundFromAccountId: account.id,
      fundAmount: 300,
    });

    await authedPage.goto("/goals");
    const goalCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "Progress Test" });
    // 300 / 400 = 75%
    await expect(goalCard.locator(".text-xs.text-muted-foreground.text-right")).toContainText("75%");

    // The progress bar inner div should have width: 75% (after animation)
    // The bar uses transition-[width] duration-700 and starts at 0%, animating via rAF
    const progressBarInner = goalCard.locator(".rounded-full.bg-primary").first();
    // Wait for the animation to settle (duration-700 = 700ms)
    await progressBarInner.waitFor({ state: "visible" });
    await expect(progressBarInner).toHaveAttribute("style", /width:\s*75%/, { timeout: 5000 });
  });

  // ── 11. Large target amount formats correctly ──────────────────────────

  test("goal with large target amount ($100,000) formats correctly", async ({
    authedPage,
    testUser,
  }) => {
    await seedGoal(testUser.id, {
      name: "Retirement Boost",
      targetAmount: 100000,
    });

    await authedPage.goto("/goals");
    const goalCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "Retirement Boost" });
    await expect(goalCard.locator(".text-sm.text-muted-foreground", { hasText: "of" })).toContainText("of $100,000.00");
  });

  // ── 13. Navigation from dashboard "View all" link ──────────────────────

  test("navigating to goals from dashboard View all link", async ({
    authedPage,
    testUser,
  }) => {
    await seedGoal(testUser.id, {
      name: "Dashboard Goal",
      targetAmount: 1500,
    });

    // Start on the dashboard
    await authedPage.goto("/dashboard");
    await expect(authedPage.getByText("Dashboard Goal")).toBeVisible();

    // Find the "View all" link in the Goals section heading
    const goalsHeading = authedPage.locator("h2", { hasText: "Goals" });
    const goalsSection = goalsHeading.locator("..");
    const viewAllLink = goalsSection.getByRole("link", { name: "View all" });
    await viewAllLink.click();

    // Should navigate to /goals
    await authedPage.waitForURL("**/goals**");
    const goalCard = authedPage.locator('[data-slot="card"]').filter({ hasText: "Dashboard Goal" });
    await expect(goalCard.locator('[data-slot="card-title"]')).toContainText("Dashboard Goal");
    await expect(goalCard.locator(".text-sm.text-muted-foreground", { hasText: "of" })).toContainText("of $1,500.00");
  });
});
