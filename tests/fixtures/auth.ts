/**
 * Auth fixtures for E2E tests.
 *
 * Provides helpers to create users directly in the DB (bypassing email
 * verification) and obtain authenticated Playwright browser contexts.
 */

import { test as base, expect, type Page } from "@playwright/test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../../src/lib/db/schema";
import { hash } from "bcryptjs";

// ── DB connection (reused across all tests in one worker) ────────────────

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString, { max: 5 });
export const db = drizzle(sql, { schema });

// ── Helpers ───────────────────────────────────────────────────────────────

let userCounter = 0;

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${++userCounter}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
}

/**
 * Create a verified user directly in the DB. Returns the user details
 * including the plaintext password for login.
 */
export async function createVerifiedUser(
  overrides: { name?: string; email?: string; password?: string; currency?: string } = {},
): Promise<TestUser> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? "TestPassword123!";
  const name = overrides.name ?? "E2E User";
  const passwordHash = await hash(password, 12);

  const [user] = await db
    .insert(schema.users)
    .values({
      email,
      name,
      passwordHash,
      emailVerified: true,
      currency: overrides.currency ?? "USD",
    })
    .returning();

  return { id: user.id, email, password, name };
}

/**
 * Create an unverified user directly in the DB.
 */
export async function createUnverifiedUser(
  overrides: { name?: string; email?: string; password?: string } = {},
): Promise<TestUser> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? "TestPassword123!";
  const name = overrides.name ?? "E2E Unverified";
  const passwordHash = await hash(password, 12);

  const [user] = await db
    .insert(schema.users)
    .values({
      email,
      name,
      passwordHash,
      emailVerified: false,
    })
    .returning();

  return { id: user.id, email, password, name };
}

/**
 * Delete a test user and all cascading data.
 *
 * journal_lines has onDelete:"restrict" on accountId, so we must delete
 * journal entries (which cascade to lines) before users can cascade to accounts.
 */
export async function deleteTestUser(userId: string) {
  // Delete journal entries first (cascades to journal_lines)
  await db.delete(schema.journalEntries).where(eq(schema.journalEntries.userId, userId));
  // Now user cascade to accounts/goals/etc. will succeed
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}

/**
 * Log in via the UI and return the authenticated page.
 */
export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  // Wait for redirect to dashboard or home
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });
}

/**
 * Clear rate limit entries for a given key prefix.
 */
export async function clearRateLimits(keyPrefix: string) {
  await db.delete(schema.rateLimitAttempts).where(
    eq(schema.rateLimitAttempts.key, keyPrefix),
  );
}

/**
 * Clear all rate limit entries matching a pattern (using raw SQL for LIKE).
 */
export async function clearRateLimitsByPattern(keyPattern: string) {
  await sql`DELETE FROM rate_limit_attempts WHERE key LIKE ${keyPattern}`;
}

// ── Extended test fixture ────────────────────────────────────────────────

type TestFixtures = {
  /** A freshly created, verified user. Cleaned up after the test. */
  testUser: TestUser;
  /** A page already logged in as testUser. */
  authedPage: Page;
};

export const test = base.extend<TestFixtures>({
  testUser: async ({}, use) => {
    const user = await createVerifiedUser();
    await use(user);
    await deleteTestUser(user.id);
  },

  authedPage: async ({ page, testUser }, use) => {
    await loginViaUI(page, testUser.email, testUser.password);

    // Next.js App Router components using useSearchParams (AppSidebar, DateSelector, etc.)
    // cause a brief double-render during React hydration. Waiting for network idle ensures
    // hydration is complete before any assertion runs.
    //
    // Scope note: this patch is intentionally applied to ALL navigations made by tests
    // that use the `authedPage` fixture. `loginViaUI` above is NOT covered because it
    // completes before the patch is installed — login has its own `waitForURL` strategy.
    // Any test helper that internally calls `page.goto` WILL get the networkidle wait,
    // which is the desired behaviour for post-login navigations.
    const originalGoto = page.goto.bind(page);
    page.goto = async (url: string, options?: Parameters<typeof page.goto>[1]) => {
      const response = await originalGoto(url, options);
      await page.waitForLoadState("networkidle");
      return response;
    };

    await use(page);
  },
});

export { expect };
