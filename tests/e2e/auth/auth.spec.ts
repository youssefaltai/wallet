import { test, expect } from "../../fixtures/auth";
import {
  createVerifiedUser,
  createUnverifiedUser,
  deleteTestUser,
  uniqueEmail,
  clearRateLimitsByPattern,
  db,
} from "../../fixtures/auth";
import { eq } from "drizzle-orm";
import * as schema from "../../../src/lib/db/schema";

// ── Signup ───────────────────────────────────────────────────────────────

test.describe("Signup", () => {
  test("valid credentials → redirects to verify-email page", async ({
    page,
  }) => {
    const email = uniqueEmail();

    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("ValidPass123!");
    await page.getByRole("button", { name: "Sign up" }).click();

    await page.waitForURL((url) => url.pathname.includes("/verify-email"), {
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/verify-email\?userId=/);

    // Clean up: find and delete the user we just created
    const [user] = await db
      .select()
      .from(schema.users)
      .where(
        eq(schema.users.email, email),
      );
    if (user) {
      await deleteTestUser(user.id);
    }
  });

  test("duplicate verified email → shows error", async ({ page }) => {
    const user = await createVerifiedUser();

    try {
      await page.goto("/signup");
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password").fill("AnotherPass123!");
      await page.getByRole("button", { name: "Sign up" }).click();

      await expect(
        page.getByText("An account with this email already exists"),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("duplicate unverified email → redirects to verify-email (resends code)", async ({
    page,
  }) => {
    const user = await createUnverifiedUser();

    try {
      await page.goto("/signup");
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password").fill(user.password);
      await page.getByRole("button", { name: "Sign up" }).click();

      await page.waitForURL((url) => url.pathname.includes("/verify-email"), {
        timeout: 15_000,
      });
      await expect(page).toHaveURL(/\/verify-email\?userId=/);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("invalid email format → HTML validation prevents submit", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("ValidPass123!");
    await page.getByRole("button", { name: "Sign up" }).click();

    // The form should not navigate — browser validation prevents submission
    await expect(page).toHaveURL(/\/signup/);

    // Verify the email input reports a validation error
    const emailInput = page.getByLabel("Email");
    const isInvalid = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.checkValidity(),
    );
    expect(isInvalid).toBe(true);
  });

  test("short password (<8 chars) → HTML validation prevents submit", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.getByLabel("Email").fill(uniqueEmail());
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Sign up" }).click();

    // The form should not navigate — browser validation prevents submission
    await expect(page).toHaveURL(/\/signup/);

    // Verify the password input reports a validation error
    const passwordInput = page.getByLabel("Password");
    const isInvalid = await passwordInput.evaluate(
      (el: HTMLInputElement) => !el.checkValidity(),
    );
    expect(isInvalid).toBe(true);
  });
});

// ── Login ────────────────────────────────────────────────────────────────

test.describe("Login", () => {
  test("valid credentials → redirects to dashboard", async ({ page }) => {
    const user = await createVerifiedUser();

    try {
      await page.goto("/login");
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password").fill(user.password);
      await page.getByRole("button", { name: "Log in" }).click();

      await page.waitForURL(
        (url) => !url.pathname.includes("/login"),
        { timeout: 15_000 },
      );
      // Login redirects to "/" which then redirects to /chat
      await expect(page).toHaveURL(/\/(chat|dashboard)/);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("wrong password → shows error message", async ({ page }) => {
    const user = await createVerifiedUser();

    try {
      await page.goto("/login");
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password").fill("WrongPassword99!");
      await page.getByRole("button", { name: "Log in" }).click();

      await expect(
        page.getByText("Invalid email or password"),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("non-existent email → shows error message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(uniqueEmail());
    await page.getByLabel("Password").fill("SomePassword123!");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(
      page.getByText("Invalid email or password"),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("unverified email → shows error message", async ({ page }) => {
    const user = await createUnverifiedUser();

    try {
      await page.goto("/login");
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password").fill(user.password);
      await page.getByRole("button", { name: "Log in" }).click();

      await expect(
        page.getByText("Invalid email or password"),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

// ── Logout ───────────────────────────────────────────────────────────────

test.describe("Logout", () => {
  test("logout → redirects to login page", async ({ authedPage }) => {
    // authedPage is already logged in and past login redirect
    // Open the user menu in the sidebar footer and click "Log out"
    await authedPage.goto("/dashboard");
    await authedPage.waitForURL(/\/(dashboard)?/, { timeout: 15_000 });

    // The sidebar has a dropdown menu at the bottom with the user name
    // Click the sidebar menu button to open the dropdown
    const sidebarFooter = authedPage.locator("[data-sidebar='footer']");
    await sidebarFooter.locator("button").first().click();

    // Click "Log out" in the dropdown
    await authedPage.getByText("Log out").click();

    await authedPage.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(authedPage).toHaveURL(/\/login/);
  });
});

// ── Auth Guards ──────────────────────────────────────────────────────────

test.describe("Auth Guards", () => {
  test("protected route redirects to login when not authenticated", async ({
    page,
  }) => {
    // Clear any cookies so we're not authenticated
    await page.context().clearCookies();
    await page.goto("/dashboard");

    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("auth pages redirect to home when already logged in", async ({
    authedPage,
  }) => {
    // authedPage is already authenticated — visiting /login should redirect
    await authedPage.goto("/login");
    await authedPage.waitForURL(
      (url) => !url.pathname.includes("/login"),
      { timeout: 15_000 },
    );
    // Should redirect away from login
    expect(authedPage.url()).not.toContain("/login");

    // Also test /signup
    await authedPage.goto("/signup");
    await authedPage.waitForURL(
      (url) => !url.pathname.includes("/signup"),
      { timeout: 15_000 },
    );
    expect(authedPage.url()).not.toContain("/signup");
  });
});

// ── Rate Limiting ────────────────────────────────────────────────────────

test.describe("Rate Limiting", () => {
  test("login rate limit — 6th attempt shows distinct rate-limit error", async ({
    page,
  }) => {
    const user = await createVerifiedUser();

    try {
      // Clear any prior rate-limit entries for this email
      await clearRateLimitsByPattern(`%login%${user.email}%`);

      await page.goto("/login");

      // Attempts 1–5: wrong password within the rate limit — generic error
      for (let i = 1; i <= 5; i++) {
        await page.getByLabel("Email").fill(user.email);
        await page.getByLabel("Password").fill("WrongPassword!");
        await page.getByRole("button", { name: "Log in" }).click();

        await expect(
          page.getByText("Invalid email or password"),
        ).toBeVisible({ timeout: 10_000 });

        await page.getByLabel("Email").clear();
        await page.getByLabel("Password").clear();
      }

      // Attempt 6: rate limit exceeded — must show the distinct rate-limit message
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password").fill("WrongPassword!");
      await page.getByRole("button", { name: "Log in" }).click();

      await expect(
        page.getByText("Too many login attempts. Please wait a few minutes and try again."),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await clearRateLimitsByPattern(`%login%${user.email}%`);
      await deleteTestUser(user.id);
    }
  });
});

// ── Navigation Links ─────────────────────────────────────────────────────

test.describe("Navigation Links", () => {
  test("signup page has link to login, login page has link to signup", async ({
    page,
  }) => {
    // Check signup page has login link
    await page.goto("/signup");
    const loginLink = page.getByRole("link", { name: "Log in" });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", "/login");

    // Check login page has signup link
    await page.goto("/login");
    const signupLink = page.getByRole("link", { name: "Sign up" });
    await expect(signupLink).toBeVisible();
    await expect(signupLink).toHaveAttribute("href", "/signup");
  });
});

// ── Email Verification ──────────────────────────────────────────────────

test.describe("Email Verification", () => {
  test("wrong code → shows error", async ({ page }) => {
    const user = await createUnverifiedUser();

    try {
      // Clear any prior rate-limit entries for this user
      await clearRateLimitsByPattern(`%verify-email%${user.id}%`);

      await page.goto(`/verify-email?userId=${user.id}`);

      // Wait for the OTP inputs to appear
      await expect(page.getByText("Verify your email")).toBeVisible({
        timeout: 10_000,
      });

      // Enter a wrong 6-digit code — fill each digit input
      const digitInputs = page.locator('input[inputmode="numeric"]');
      await expect(digitInputs).toHaveCount(6);

      const wrongCode = "000000";
      for (let i = 0; i < 6; i++) {
        await digitInputs.nth(i).fill(wrongCode[i]);
      }

      // The form auto-submits when the 6th digit is filled.
      // Wait for the error message.
      await expect(
        page.getByText(/invalid|expired|verification failed/i),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await clearRateLimitsByPattern(`%verify-email%${user.id}%`);
      await deleteTestUser(user.id);
    }
  });
});
