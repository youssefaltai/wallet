---
paths:
  - "tests/**"
  - "playwright.config.ts"
---

# E2E Testing Rules

Rules for writing and modifying Playwright E2E tests in `tests/e2e/`.

## Setup

Tests run via `pnpm test:e2e`. Playwright auto-starts `pnpm dev` if no server is already on port 3000 (`reuseExistingServer: true`). No manual server management needed.

## File Structure

```
tests/
  e2e/
    {domain}/
      {domain}.spec.ts    ← one file per domain
  fixtures/
    auth.ts               ← auth fixtures + helpers
    db-helpers.ts         ← direct DB seeding helpers
```

One spec file per domain. Match the route structure: `accounts/`, `budgets/`, `goals/`, `transactions/`, `chat/`, `auth/`, `dashboard/`, etc.

## Always Import from Fixtures

```typescript
import { test, expect } from "../../fixtures/auth";
import { seedAccount, seedBalance, seedGoal, seedBudget } from "../../fixtures/db-helpers";
import { db } from "../../fixtures/auth"; // for direct DB queries in tests
```

Never import from `@playwright/test` directly — always use the extended `test` from `fixtures/auth`, which provides `testUser` and `authedPage`.

## Auth Fixtures

Two built-in fixtures are pre-wired:

```typescript
test("example", async ({ authedPage, testUser }) => {
  // authedPage: a Page already logged in as testUser
  // testUser: { id, email, password, name } — a fresh verified user
  // Both are automatically cleaned up after each test
});
```

The `testUser` fixture creates a user directly in the DB (no email verification needed) and deletes it (and all cascading data) after the test. **Do not call `deleteTestUser` manually** when using these fixtures — the fixture handles it.

## Direct DB Seeding (not via UI)

Seed test data directly via DB helpers — never via UI navigation. This is fast and deterministic.

```typescript
import { seedAccount, seedBalance, seedCategoryAccount, seedExpense, seedGoal, seedBudget, seedIncome, seedJournalEntry } from "../../fixtures/db-helpers";

test("shows account balance", async ({ authedPage, testUser }) => {
  const account = await seedAccount(testUser.id, {
    name: "Checking",
    type: "asset",
    institution: "Chase",
    currency: "USD",
  });
  await seedBalance(testUser.id, account.id, 1500.75); // amount in major units

  await authedPage.goto("/accounts");
  // now assert the UI shows the data
});
```

## Cleanup Ordering — CRITICAL

If you create data manually (not via `testUser` fixture), delete it in the correct order:

```typescript
// journal_lines has onDelete:"restrict" on accountId
// → delete journal entries BEFORE deleting users or accounts
await db.delete(schema.journalEntries).where(eq(schema.journalEntries.userId, userId));
await db.delete(schema.users).where(eq(schema.users.id, userId));
```

Or use `deleteTestUser(userId)` from fixtures/auth — it handles the correct order.

## Selectors — Prefer Semantic

Order of preference:

1. `page.getByLabel("Email")` — ARIA label (forms)
2. `page.getByRole("button", { name: "Save" })` — ARIA role
3. `page.getByText("No accounts yet")` — visible text
4. `page.getByPlaceholder("Type a message...")` — placeholder
5. `page.locator('[data-slot="card"]').filter({ hasText: "Checking" })` — Radix UI data attributes for components
6. `page.locator(".animate-fade-in-left")` — CSS classes only when no semantic selector works (e.g., AI response detection)

**Avoid:** `page.locator('#id')`, `page.locator('div > span.foo')` unless absolutely necessary.

## Card Component Scoping

When asserting inside a specific card (to avoid strict mode violations from multiple matches):

```typescript
const card = page.locator('[data-slot="card"]').filter({ hasText: "Account Name" });
await expect(card).toBeVisible();
await expect(card.locator(".text-2xl")).toContainText("$1,500.75");
```

## Never Use `waitForTimeout`

```typescript
// ✗ Never
await page.waitForTimeout(2000);

// ✓ Always wait for a condition
await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 15_000 });
await expect(page.getByText("Success")).toBeVisible();
```

## Rate Limit Tests

Auth tests can interfere with rate limits. Clear before testing:

```typescript
import { clearRateLimitsByPattern } from "../../fixtures/auth";

test.beforeEach(async () => {
  await clearRateLimitsByPattern("login:%"); // or "signup:%" etc.
});
```

## Chat / AI Tests

AI responses are non-deterministic. Test observable behavior (UI updates, tool cards appearing), not exact text:

```typescript
// Wait for AI response — send button reappears when streaming is done
await sendButton(page).click();
await page.locator(".animate-fade-in-left").first().waitFor({ timeout: 60_000 });

// Assert a tool card appeared, not the exact AI wording
await expect(page.getByText("Account created")).toBeVisible();
```

Never assert on the AI's exact sentence — it changes between model versions.

## Test Independence

Each test must create its own user and seed its own data. Never share state across tests.

```typescript
// ✓ Each test gets its own testUser via fixture
test("test A", async ({ authedPage, testUser }) => { ... });
test("test B", async ({ authedPage, testUser }) => { ... }); // different user
```

`fullyParallel: true` is set globally — tests run concurrently across workers. Tests that share state will race.

## When to Write Tests

Write a Playwright E2E test when:
- Adding a new page or form
- Adding a new AI tool that has visible UI output (tool card)
- Fixing a UI bug — add a regression test
- Adding auth flows (new route, new permission check)

Skip E2E tests for:
- Pure service-layer changes (unit test instead, or rely on TypeScript + invariant grep)
- Schema migrations (checker validates migration sync)
- Non-user-facing API endpoints (rely on TypeScript + integration coverage from existing E2E)
