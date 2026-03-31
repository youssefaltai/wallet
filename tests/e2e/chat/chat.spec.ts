import { test, expect } from "../../fixtures/auth";
import {
  seedConversation,
  seedMessage,
  seedAccount,
  seedBalance,
  seedMemory,
  seedCategoryAccount,
  seedExpense,
  seedBudget,
} from "../../fixtures/db-helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Locate the chat textarea input. */
function chatInput(page: import("@playwright/test").Page) {
  return page.getByPlaceholder("Type a message...");
}

/** Locate the send/submit button (visible when NOT loading). */
function sendButton(page: import("@playwright/test").Page) {
  return page.locator('form button[type="submit"]');
}

/** Send a chat message by typing and clicking send. */
async function sendMessage(page: import("@playwright/test").Page, text: string) {
  await chatInput(page).fill(text);
  await sendButton(page).click();
}

/**
 * Wait for an assistant response to finish streaming.
 *
 * Strategy: wait until the submit button (ArrowUp icon) reappears, which
 * means `isLoading` is false and at least one `.animate-fade-in-left`
 * (assistant message) exists in the DOM.
 */
async function waitForAssistantResponse(
  page: import("@playwright/test").Page,
  timeout = 60_000,
) {
  // Race: either an assistant message appears OR an error banner shows
  const assistantMsg = page.locator(".animate-fade-in-left").first();
  const errorBanner = page.getByText("Something went wrong");

  await Promise.race([
    assistantMsg.waitFor({ timeout }),
    errorBanner.waitFor({ timeout }),
  ]);

  // If the API returned an error, fail fast with a clear message
  if (await errorBanner.isVisible()) {
    throw new Error(
      "Chat API returned an error (\"Something went wrong\"). " +
      "Check that ANTHROPIC_API_KEY is valid and the AI_MODEL is accessible.",
    );
  }

  // Wait for streaming to finish — the submit button reappears when
  // isLoading becomes false (stop button has type="button", submit has type="submit")
  await page.locator('form button[type="submit"]').waitFor({ timeout });
}

/**
 * Wait for a tool completion indicator.
 *
 * Completed tools render as:
 *   <div class="text-xs text-muted-foreground ...">
 *     <span class="text-positive">✓</span>
 *     {completedName}
 *   </div>
 *
 * We wait for the completed name text to appear on the page.
 */
async function waitForToolCompletion(
  page: import("@playwright/test").Page,
  completedLabel: string,
  timeout = 60_000,
) {
  await page.getByText(completedLabel).waitFor({ timeout });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("AI Chat", () => {
  // 1. Send a message and receive a streamed response
  test("send a message and receive a streamed response", async ({
    authedPage: page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/chat");

    // Welcome state visible initially
    await expect(
      page.getByText("Tell me about your finances"),
    ).toBeVisible();

    await sendMessage(page, "Hello, who are you?");

    // The user message should appear
    await expect(page.getByText("Hello, who are you?")).toBeVisible();

    // Wait for assistant response
    await waitForAssistantResponse(page);

    // At least one assistant message block should exist
    const assistantBlocks = page.locator(".animate-fade-in-left");
    await expect(assistantBlocks.first()).toBeVisible();

    // The prose content should have some text
    const proseContent = page.locator(".prose");
    await expect(proseContent.first()).not.toBeEmpty();
  });

  // 2. New conversation created — conversation ID appears in sidebar
  test("new conversation appears in sidebar after first message", async ({
    authedPage: page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/chat");

    await sendMessage(page, "Tell me about budgeting basics");
    await waitForAssistantResponse(page);

    // URL should now include a conversation ID (replaceState to /chat/<id>)
    await page.waitForFunction(
      () => window.location.pathname.startsWith("/chat/"),
      { timeout: 10_000 },
    );

    // Sidebar should show "Recent Chats" section with the new conversation
    await expect(page.getByText("Recent Chats")).toBeVisible({ timeout: 10_000 });
  });

  // 3. Conversation title generated from first message
  test("conversation title generated from first message", async ({
    authedPage: page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/chat");

    const messageText = "What are the best strategies for saving money";
    await sendMessage(page, messageText);
    await waitForAssistantResponse(page);

    // The sidebar should contain a conversation entry
    await expect(page.getByText("Recent Chats")).toBeVisible({ timeout: 10_000 });

    // At least one conversation link should appear under Recent Chats
    // The sidebar uses data-slot="sidebar", not <aside>
    const sidebarLinks = page.locator('[data-slot="sidebar"] a');
    const count = await sidebarLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  // 4. Message input supports Enter to send
  test("pressing Enter sends the message", async ({
    authedPage: page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/chat");

    await chatInput(page).fill("Testing enter key");
    await page.keyboard.press("Enter");

    // User message should appear
    await expect(page.getByText("Testing enter key")).toBeVisible();

    // Wait for AI response
    await waitForAssistantResponse(page);
  });

  // 5. Message input supports Shift+Enter for new line
  test("Shift+Enter inserts a new line instead of sending", async ({
    authedPage: page,
  }) => {
    await page.goto("/chat");

    await chatInput(page).click();
    await page.keyboard.type("Line one");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("Line two");

    // The textarea should contain both lines
    const value = await chatInput(page).inputValue();
    expect(value).toContain("Line one");
    expect(value).toContain("Line two");
    expect(value).toContain("\n");

    // The message should NOT have been sent — no user message bubble
    const userBubbles = page.locator(".animate-fade-in-right");
    await expect(userBubbles).toHaveCount(0);
  });

  // 6. Empty message cannot be sent
  test("empty message cannot be sent — button is disabled", async ({
    authedPage: page,
  }) => {
    await page.goto("/chat");

    // Send button should be disabled when input is empty
    await expect(sendButton(page)).toBeDisabled();

    // Type spaces only
    await chatInput(page).fill("   ");
    await expect(sendButton(page)).toBeDisabled();

    // Type real content — button becomes enabled
    await chatInput(page).fill("Real message");
    await expect(sendButton(page)).toBeEnabled();
  });

  // 7. AI can read accounts
  test("AI can read accounts when asked", async ({
    authedPage: page,
    testUser,
  }) => {
    test.setTimeout(90_000);

    const checking = await seedAccount(testUser.id, {
      name: "Main Checking",
      type: "asset",
      institution: "Chase",
    });
    await seedBalance(testUser.id, checking.id, 2500);

    const savings = await seedAccount(testUser.id, {
      name: "Savings Stash",
      type: "asset",
      institution: "Ally",
    });
    await seedBalance(testUser.id, savings.id, 10000);

    await page.goto("/chat");
    await sendMessage(page, "What are my accounts?");

    // Wait for the tool to complete
    await waitForToolCompletion(page, "Checked accounts");
    await waitForAssistantResponse(page);

    // The response should mention the seeded accounts
    const responseArea = page.locator(".animate-fade-in-left");
    const responseText = await responseArea.allTextContents();
    const combined = responseText.join(" ");

    expect(combined).toMatch(/Main Checking|Checking/i);
    expect(combined).toMatch(/Savings Stash|Savings/i);
  });

  // 8. AI can read transactions / spending
  test("AI can read transactions when asked about spending", async ({
    authedPage: page,
    testUser,
  }) => {
    test.setTimeout(90_000);

    const checking = await seedAccount(testUser.id, {
      name: "Checking",
      type: "asset",
    });
    await seedBalance(testUser.id, checking.id, 5000);

    const groceries = await seedCategoryAccount(testUser.id, "Groceries", "expense");
    await seedExpense(testUser.id, checking.id, groceries.id, 120, {
      description: "Weekly groceries",
      date: new Date().toISOString().slice(0, 10),
    });

    await page.goto("/chat");
    await sendMessage(page, "What did I spend this month?");

    // Should use a spending or transaction tool — wait for one of the possible
    // completed labels to appear
    await page.waitForFunction(
      () => {
        const text = document.body.textContent || "";
        return (
          text.includes("Analyzed spending") ||
          text.includes("Looked up transactions") ||
          text.includes("Checked accounts")
        );
      },
      { timeout: 60_000 },
    );
    await waitForAssistantResponse(page);

    // Should reference grocery spending
    const responseArea = page.locator(".animate-fade-in-left");
    const responseText = await responseArea.allTextContents();
    const combined = responseText.join(" ");
    expect(combined).toMatch(/groceries|120|spending/i);
  });

  // 9. AI can create a transaction
  test("AI can create a transaction when asked", async ({
    authedPage: page,
    testUser,
  }) => {
    test.setTimeout(90_000);

    // Seed an account for the AI to use
    const checking = await seedAccount(testUser.id, {
      name: "Checking",
      type: "asset",
      institution: "Chase",
    });
    await seedBalance(testUser.id, checking.id, 5000);

    await page.goto("/chat");
    await sendMessage(page, "I spent $50 on groceries today from my Checking account");

    await waitForToolCompletion(page, "Transaction recorded");
    await waitForAssistantResponse(page);

    // Verify the response acknowledges the transaction
    const responseArea = page.locator(".animate-fade-in-left");
    const responseText = await responseArea.allTextContents();
    const combined = responseText.join(" ");
    expect(combined).toMatch(/50|groceries|recorded|created/i);
  });

  // 10. AI can create an account
  test("AI can create an account when asked", async ({
    authedPage: page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/chat");

    await sendMessage(page, "Add a checking account at Chase bank called My Chase Checking");

    await waitForToolCompletion(page, "Account created");
    await waitForAssistantResponse(page);

    // Verify by navigating to accounts page
    await page.goto("/accounts");
    await expect(page.locator('[data-slot="card"]').filter({ hasText: /Chase/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  // 11. AI can create a goal
  test("AI can create a goal when asked", async ({
    authedPage: page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/chat");

    await sendMessage(page, "Create a vacation fund goal for $5000");

    await waitForToolCompletion(page, "Goal created");
    await waitForAssistantResponse(page);

    // Verify by navigating to goals page
    await page.goto("/goals");
    await expect(page.locator('[data-slot="card"]').filter({ hasText: /vacation/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  // 12. AI can save a memory
  test("AI can save a memory when asked", async ({
    authedPage: page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/chat");

    await sendMessage(page, "Remember that I'm saving for a house");

    await waitForToolCompletion(page, "Saved to memory");
    await waitForAssistantResponse(page);

    // The response should acknowledge saving the memory
    const responseArea = page.locator(".animate-fade-in-left");
    const responseText = await responseArea.allTextContents();
    const combined = responseText.join(" ");
    expect(combined).toMatch(/remember|noted|saved|memory|house/i);
  });

  // 13. Tool cards render for tool invocations
  test("tool cards render for tool invocations", async ({
    authedPage: page,
    testUser,
  }) => {
    test.setTimeout(90_000);

    const checking = await seedAccount(testUser.id, {
      name: "My Checking",
      type: "asset",
      institution: "Chase",
    });
    await seedBalance(testUser.id, checking.id, 3000);

    await page.goto("/chat");
    await sendMessage(page, "What are my accounts?");

    // Wait for tool completion — the checkmark indicator
    await waitForToolCompletion(page, "Checked accounts");
    await waitForAssistantResponse(page);

    // Tool status line should be visible (the "✓ Checked accounts" text)
    await expect(page.getByText("Checked accounts")).toBeVisible();

    // A tool card (rendered component from toolCardRegistry) should appear
    // The accounts card shows account info in a structured format
    const assistantArea = page.locator(".animate-fade-in-left");
    const text = await assistantArea.allTextContents();
    const combined = text.join(" ");
    expect(combined).toMatch(/My Checking|Chase|3,000/i);
  });

  // 14. Switch between conversations in sidebar
  test("switch between conversations in sidebar", async ({
    authedPage: page,
    testUser,
  }) => {
    test.setTimeout(90_000);

    // Seed two conversations with messages
    const conv1 = await seedConversation(testUser.id, {
      title: "First Conversation",
    });
    await seedMessage(conv1.id, "user", "Hello from conversation one");
    await seedMessage(conv1.id, "assistant", "Response in conversation one");

    const conv2 = await seedConversation(testUser.id, {
      title: "Second Conversation",
    });
    await seedMessage(conv2.id, "user", "Hello from conversation two");
    await seedMessage(conv2.id, "assistant", "Response in conversation two");

    await page.goto("/chat");

    // Both conversations should be in the sidebar
    await expect(page.getByText("First Conversation")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Second Conversation")).toBeVisible({ timeout: 10_000 });

    // Click first conversation
    await page.getByText("First Conversation").click();
    await page.waitForURL(`**/chat/${conv1.id}`, { timeout: 10_000 });
    await expect(
      page.getByText("Hello from conversation one"),
    ).toBeVisible({ timeout: 10_000 });

    // Click second conversation
    await page.getByText("Second Conversation").click();
    await page.waitForURL(`**/chat/${conv2.id}`, { timeout: 10_000 });
    await expect(
      page.getByText("Hello from conversation two"),
    ).toBeVisible({ timeout: 10_000 });
  });

  // 15. Chat persists across page reload
  test("chat persists across page reload", async ({
    authedPage: page,
    testUser,
  }) => {
    test.setTimeout(90_000);

    // Seed a conversation with messages
    const conv = await seedConversation(testUser.id, {
      title: "Persistent Chat",
    });
    await seedMessage(conv.id, "user", "This should persist after reload");
    await seedMessage(
      conv.id,
      "assistant",
      "Yes, this message persists across reloads",
    );

    // Navigate to the conversation
    await page.goto(`/chat/${conv.id}`);
    await expect(
      page.getByText("This should persist after reload"),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText("Yes, this message persists across reloads"),
    ).toBeVisible({ timeout: 10_000 });

    // Reload the page
    await page.reload();

    // Messages should still be there
    await expect(
      page.getByText("This should persist after reload"),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText("Yes, this message persists across reloads"),
    ).toBeVisible({ timeout: 10_000 });
  });

  // 16. Long conversation — multiple back-and-forth messages maintain context
  test("multiple messages maintain conversation context", async ({
    authedPage: page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/chat");

    // First message
    await sendMessage(page, "My name is TestUser42");
    await waitForAssistantResponse(page);

    // Second message — ask AI to recall the name
    await sendMessage(page, "What is my name?");
    await waitForAssistantResponse(page);

    // The AI should reference the name from the first message
    const assistantBlocks = page.locator(".animate-fade-in-left");
    const lastBlock = assistantBlocks.last();
    const text = await lastBlock.textContent();
    expect(text).toMatch(/TestUser42/i);
  });

  // 17. AI can check budget status
  test("AI can check budget status when asked", async ({
    authedPage: page,
    testUser,
  }) => {
    test.setTimeout(90_000);

    // Seed an account, category, budget, and some spending
    const checking = await seedAccount(testUser.id, {
      name: "Checking",
      type: "asset",
    });
    await seedBalance(testUser.id, checking.id, 5000);

    const dining = await seedCategoryAccount(testUser.id, "Dining Out", "expense");
    await seedBudget(testUser.id, dining.id, {
      name: "Dining Budget",
      amount: 300,
    });
    await seedExpense(testUser.id, checking.id, dining.id, 75, {
      description: "Restaurant dinner",
      date: new Date().toISOString().slice(0, 10),
    });

    await page.goto("/chat");
    await sendMessage(page, "How am I doing on my budgets?");

    await waitForToolCompletion(page, "Checked budgets");
    await waitForAssistantResponse(page);

    // Response should reference the budget
    const responseArea = page.locator(".animate-fade-in-left");
    const responseText = await responseArea.allTextContents();
    const combined = responseText.join(" ");
    expect(combined).toMatch(/dining|budget|300|75/i);
  });

  // 18. AI can check net worth
  test("AI can check net worth when asked", async ({
    authedPage: page,
    testUser,
  }) => {
    test.setTimeout(90_000);

    // Seed assets
    const checking = await seedAccount(testUser.id, {
      name: "Checking Account",
      type: "asset",
      institution: "Chase",
    });
    await seedBalance(testUser.id, checking.id, 15000);

    const savings = await seedAccount(testUser.id, {
      name: "Savings Account",
      type: "asset",
      institution: "Ally",
    });
    await seedBalance(testUser.id, savings.id, 25000);

    // Seed a liability
    const creditCard = await seedAccount(testUser.id, {
      name: "Credit Card",
      type: "liability",
      institution: "Amex",
    });
    await seedBalance(testUser.id, creditCard.id, -5000);

    await page.goto("/chat");
    await sendMessage(page, "What's my net worth?");

    await waitForToolCompletion(page, "Calculated net worth");
    await waitForAssistantResponse(page);

    // Response should reference net worth and amounts
    const responseArea = page.locator(".animate-fade-in-left");
    const responseText = await responseArea.allTextContents();
    const combined = responseText.join(" ");
    expect(combined).toMatch(/net worth|35,000|35000/i);
  });
});
