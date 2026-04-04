import { test, expect } from "../../fixtures/auth";
import { createVerifiedUser, deleteTestUser, db } from "../../fixtures/auth";
import { seedConversation, seedMemory } from "../../fixtures/db-helpers";
import * as schema from "../../../src/lib/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Helper: open the settings dialog from the sidebar user dropdown
// ---------------------------------------------------------------------------

async function openSettings(page: import("@playwright/test").Page) {
  // The sidebar footer has a DropdownMenu trigger rendered as a SidebarMenuButton.
  // It displays the user's name or "Account" as fallback text.
  // Click the dropdown trigger button in the sidebar footer.
  await page
    .locator("[data-slot='sidebar'] [data-slot='sidebar-footer']")
    .getByRole("button")
    .click();

  // Click "Settings" in the dropdown menu
  await page.getByRole("menuitem", { name: "Settings" }).click();

  // Wait for the settings dialog to be visible
  await expect(
    page.getByRole("dialog").filter({ hasText: "Settings" }),
  ).toBeVisible();
}

async function switchSettingsTab(
  page: import("@playwright/test").Page,
  tabLabel: string,
) {
  const dialog = page.getByRole("dialog").filter({ hasText: "Settings" });
  // Click the nav button for the section
  await dialog.getByRole("navigation").getByRole("button", { name: tabLabel }).click();
  // Wait for the content area heading (h2.text-lg inside the scrollable content pane)
  // Note: the h2 is inside .animate-fade-up inside .overflow-y-auto (not a direct child)
  await expect(
    dialog.locator(".overflow-y-auto h2").filter({ hasText: tabLabel }),
  ).toBeVisible();
}

/** Get the settings dialog locator, scoped to avoid matching nested confirm dialogs. */
function getSettingsDialog(page: import("@playwright/test").Page) {
  return page.getByRole("dialog").filter({ hasText: "Settings" });
}

/** Click "Confirm" in the confirm dialog that appears on top of the settings dialog. */
async function confirmAction(page: import("@playwright/test").Page) {
  const confirmDialog = page
    .getByRole("dialog")
    .filter({ hasText: "Are you sure?" });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Confirm" }).click();
  // Wait for the confirm dialog to close
  await expect(confirmDialog).toBeHidden();
}

// ---------------------------------------------------------------------------
// Settings dialog E2E tests
// ---------------------------------------------------------------------------

test.describe("Settings", () => {
  // -- 1. Dialog opens from sidebar ----------------------------------------

  test("settings dialog opens from sidebar", async ({ authedPage }) => {
    await openSettings(authedPage);

    // Verify the four navigation buttons are present in the dialog's nav
    const dialog = getSettingsDialog(authedPage);
    const nav = dialog.getByRole("navigation");
    await expect(nav.getByRole("button", { name: "Profile" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Memories" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Chats" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Account" })).toBeVisible();
  });

  // -- 2. Profile section shows current name and email ---------------------

  test("profile section shows current name and email", async ({
    authedPage,
    testUser,
  }) => {
    await openSettings(authedPage);

    const dialog = getSettingsDialog(authedPage);

    // Name input pre-filled
    await expect(dialog.getByLabel("Name")).toHaveValue(testUser.name);

    // Email input pre-filled
    await expect(dialog.getByLabel("Email")).toHaveValue(testUser.email);
  });

  // -- 3. Update name -> reflected in profile section ----------------------

  test("update name is reflected in profile section", async ({
    authedPage,
  }) => {
    await openSettings(authedPage);

    const dialog = getSettingsDialog(authedPage);

    // Clear and type new name
    await dialog.getByLabel("Name").clear();
    await dialog.getByLabel("Name").fill("Updated Name");

    // Click save
    await dialog.getByRole("button", { name: "Save changes" }).click();

    // Wait for the success message
    await expect(dialog.getByText("Profile updated")).toBeVisible();

    // The name displayed in the avatar area should also update
    await expect(dialog.getByText("Updated Name")).toBeVisible();
  });

  // -- 4. Memories section shows seeded memories with tags -----------------

  test("memories section shows seeded memories with tags", async ({
    authedPage,
    testUser,
  }) => {
    // Seed two memories with distinct content and tags
    await seedMemory(testUser.id, {
      content: "Prefers dark mode",
      tags: ["preference", "ui"],
    });
    await seedMemory(testUser.id, {
      content: "Lives in New York",
      tags: ["location"],
    });

    await openSettings(authedPage);
    await switchSettingsTab(authedPage, "Memories");

    const dialog = getSettingsDialog(authedPage);

    // Wait for loading to finish and content to appear
    await expect(dialog.getByText("Prefers dark mode")).toBeVisible();
    await expect(dialog.getByText("Lives in New York")).toBeVisible();

    // Total count shown (text includes "saved by your AI assistant")
    await expect(dialog.getByText("2 memories")).toBeVisible();

    // Tags shown as badges
    await expect(dialog.locator("[data-slot='badge']", { hasText: "preference" }).first()).toBeVisible();
    await expect(dialog.locator("[data-slot='badge']", { hasText: "ui" }).first()).toBeVisible();
    await expect(dialog.locator("[data-slot='badge']", { hasText: "location" }).first()).toBeVisible();
  });

  // -- 5. Delete a single memory -> removed from list ----------------------

  test("delete a single memory removes it from list", async ({
    authedPage,
    testUser,
  }) => {
    await seedMemory(testUser.id, {
      content: "Memory to keep",
      tags: ["keep"],
    });
    await seedMemory(testUser.id, {
      content: "Memory to delete",
      tags: ["delete"],
    });

    await openSettings(authedPage);
    await switchSettingsTab(authedPage, "Memories");

    const dialog = getSettingsDialog(authedPage);
    await expect(dialog.getByText("2 memories")).toBeVisible();

    // Find the memory item containing "Memory to delete" and click its delete button.
    // DOM structure: <div.group> > <div.flex-1> > <p>{content}</p>
    // Going up two levels from the <p> gets to the <div.group> which contains the
    // delete <button aria-label="Delete memory"> (opacity-0, needs force click).
    const memoryItem = dialog.getByText("Memory to delete").locator("../..");
    await memoryItem
      .getByRole("button", { name: "Delete memory" })
      .click({ force: true });

    // Confirm the deletion in the confirm dialog
    await confirmAction(authedPage);

    // Wait for the memory to disappear
    await expect(dialog.getByText("Memory to delete")).toBeHidden();

    // Remaining memory still visible
    await expect(dialog.getByText("Memory to keep")).toBeVisible();
    await expect(dialog.getByText("1 memory")).toBeVisible();
  });

  // -- 6. Delete all memories -> list is empty -----------------------------

  test("delete all memories clears the list", async ({
    authedPage,
    testUser,
  }) => {
    await seedMemory(testUser.id, { content: "Memory A" });
    await seedMemory(testUser.id, { content: "Memory B" });

    await openSettings(authedPage);
    await switchSettingsTab(authedPage, "Memories");

    const dialog = getSettingsDialog(authedPage);
    await expect(dialog.getByText("2 memories")).toBeVisible();

    // Click "Delete all"
    await dialog.getByRole("button", { name: "Delete all" }).click();

    // Confirm
    await confirmAction(authedPage);

    // Empty state message
    await expect(dialog.getByText("No memories yet")).toBeVisible();
  });

  // -- 7. Chats section shows seeded conversations -------------------------

  test("chats section shows seeded conversations", async ({
    authedPage,
    testUser,
  }) => {
    await seedConversation(testUser.id, { title: "Budget Planning" });
    await seedConversation(testUser.id, { title: "Savings Strategy" });

    await openSettings(authedPage);
    await switchSettingsTab(authedPage, "Chats");

    const dialog = getSettingsDialog(authedPage);

    // Both chats visible in active tab
    await expect(dialog.getByText("Budget Planning")).toBeVisible();
    await expect(dialog.getByText("Savings Strategy")).toBeVisible();
  });

  // -- 8. Archive a conversation -> moves to archived tab ------------------

  test("archive a conversation moves it to archived tab", async ({
    authedPage,
    testUser,
  }) => {
    await seedConversation(testUser.id, { title: "Chat to Archive" });

    await openSettings(authedPage);
    await switchSettingsTab(authedPage, "Chats");

    const dialog = getSettingsDialog(authedPage);
    await expect(dialog.getByText("Chat to Archive")).toBeVisible();

    // Click the archive button (opacity-0 on hover, force click).
    // DOM: <div.group> > <div.flex-1> > <p>{title}</p>
    // Going up two levels from <p> reaches the <div.group> container.
    const chatItem = dialog.getByText("Chat to Archive").locator("../..");
    await chatItem
      .getByRole("button", { name: "Archive" })
      .click({ force: true });

    // Chat should disappear from active tab
    await expect(dialog.getByText("Chat to Archive")).toBeHidden();

    // Switch to Archived tab (the "Archived" Button in the chats section toggle)
    await dialog.getByRole("button", { name: "Archived" }).click();

    // Chat should appear in archived tab
    await expect(dialog.getByText("Chat to Archive")).toBeVisible();
  });

  // -- 9. Delete a conversation -> removed from list -----------------------

  test("delete a conversation removes it from list", async ({
    authedPage,
    testUser,
  }) => {
    await seedConversation(testUser.id, { title: "Chat to Keep" });
    await seedConversation(testUser.id, { title: "Chat to Delete" });

    await openSettings(authedPage);
    await switchSettingsTab(authedPage, "Chats");

    const dialog = getSettingsDialog(authedPage);
    await expect(dialog.getByText("Chat to Delete")).toBeVisible();

    // Click the delete button (opacity-0 on hover, force click).
    const chatItem = dialog.getByText("Chat to Delete").locator("../..");
    await chatItem
      .getByRole("button", { name: "Delete" })
      .click({ force: true });

    // Confirm the deletion
    await confirmAction(authedPage);

    // Chat should disappear
    await expect(dialog.getByText("Chat to Delete")).toBeHidden();

    // Other chat still visible
    await expect(dialog.getByText("Chat to Keep")).toBeVisible();
  });

  // -- 10. Account deletion -- typing "DELETE" enables the button ----------

  test("typing DELETE enables the delete account button", async ({
    authedPage,
  }) => {
    await openSettings(authedPage);
    await switchSettingsTab(authedPage, "Account");

    const dialog = getSettingsDialog(authedPage);

    // Button should be disabled initially
    const deleteButton = dialog.getByRole("button", {
      name: "Delete my account",
    });
    await expect(deleteButton).toBeDisabled();

    // The label is: Type <span>DELETE</span> to confirm
    // htmlFor="confirm-delete", so getByLabel should match
    await dialog.getByLabel(/Type.*DELETE.*confirm/i).fill("DELETE");

    // Button should now be enabled
    await expect(deleteButton).toBeEnabled();
  });

  // -- 11. Account deletion -- wrong text keeps button disabled ------------

  test("wrong confirmation text keeps delete button disabled", async ({
    authedPage,
  }) => {
    await openSettings(authedPage);
    await switchSettingsTab(authedPage, "Account");

    const dialog = getSettingsDialog(authedPage);

    const deleteButton = dialog.getByRole("button", {
      name: "Delete my account",
    });
    await expect(deleteButton).toBeDisabled();

    // Type wrong text (lowercase)
    await dialog.getByLabel(/Type.*DELETE.*confirm/i).fill("delete");
    await expect(deleteButton).toBeDisabled();

    // Type wrong text (different word)
    await dialog.getByLabel(/Type.*DELETE.*confirm/i).clear();
    await dialog.getByLabel(/Type.*DELETE.*confirm/i).fill("REMOVE");
    await expect(deleteButton).toBeDisabled();
  });

  // -- 12. Account deletion -- successful deletion signs out user ----------

  test("successful account deletion signs out user", async ({ page }) => {
    // Create a dedicated user for this test since we will delete them
    const sacrificialUser = await createVerifiedUser({
      name: "Sacrificial User",
    });

    try {
      // Log in as the sacrificial user
      await page.goto("/login");
      await page.getByLabel("Email").fill(sacrificialUser.email);
      await page.getByLabel("Password").fill(sacrificialUser.password);
      await page.getByRole("button", { name: "Log in" }).click();
      await page.waitForURL((url) => !url.pathname.includes("/login"), {
        timeout: 15_000,
      });

      await openSettings(page);
      await switchSettingsTab(page, "Account");

      const dialog = getSettingsDialog(page);

      // Type DELETE and click the button
      await dialog.getByLabel(/Type.*DELETE.*confirm/i).fill("DELETE");
      await dialog
        .getByRole("button", { name: "Delete my account" })
        .click();

      // Should redirect to login page after deletion + signout
      await page.waitForURL(/\/login/, { timeout: 15_000 });
      await expect(page).toHaveURL(/\/login/);

      // Verify the user no longer exists in the DB
      const remainingUsers = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, sacrificialUser.id));
      expect(remainingUsers).toHaveLength(0);
    } catch (error) {
      // Clean up if the test fails before deletion completes
      await deleteTestUser(sacrificialUser.id).catch(() => {});
      throw error;
    }
  });
});
