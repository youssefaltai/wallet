"use server";

/**
 * Extract a human-readable message from an unknown thrown value.
 * DrizzleQueryError wraps the real database error in `cause`; we surface that
 * instead of the opaque "Failed query: …" wrapper string.
 */
function extractError(error: unknown): string {
  if (!(error instanceof Error)) return "Operation failed";
  // DrizzleQueryError (and any other Error with a causal chain) — surface the root cause
  if (error.cause instanceof Error) return error.cause.message;
  return error.message;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createAccount, updateAccount } from "@/lib/services/accounts";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/lib/services/transactions";
import {
  createBudget,
  updateBudget,
  getBudgetDateRanges,
  type BudgetDateRange,
} from "@/lib/services/budgets";
import { createGoal, updateGoal, fundGoal } from "@/lib/services/goals";
import {
  createCategory,
  renameCategory,
  deleteCategory,
} from "@/lib/services/categories";

async function getAuthUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

async function getAuthUser(): Promise<{ id: string; currency: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return { id: session.user.id, currency: session.user.currency ?? "USD" };
}

function requireString(
  formData: FormData,
  key: string,
  maxLength?: number,
): string {
  const value = formData.get(key);
  if (typeof value !== "string" || !value) {
    throw new Error(`${key} is required`);
  }
  if (maxLength && value.length > maxLength)
    throw new Error(`${key} is too long`);
  return value;
}

function optionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string" || !value) return undefined;
  return value;
}

function requireNumber(formData: FormData, key: string): number {
  const raw = formData.get(key);
  const num = typeof raw === "string" ? parseFloat(raw) : NaN;
  if (isNaN(num)) {
    throw new Error(`${key} must be a valid number`);
  }
  return num;
}

// ── Accounts ──────────────────────────────────────────────────────────────

export async function createAccountAction(
  formData: FormData,
): Promise<{ error?: string } | void> {
  try {
    const userId = await getAuthUserId();

    const name = requireString(formData, "name", 100);
    const type = requireString(formData, "type", 50);
    if (type !== "asset" && type !== "liability")
      throw new Error("type must be 'asset' or 'liability'");
    const institution = optionalString(formData, "institution");
    if (institution && institution.length > 100)
      throw new Error("institution is too long");

    await createAccount({
      userId,
      name,
      type,
      institution,
    });

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
  } catch (error) {
    return { error: extractError(error) };
  }
}

// ── Categories ────────────────────────────────────────────────────────────

export async function createCategoryAction(
  formData: FormData,
): Promise<{ error?: string; id?: string } | void> {
  try {
    const userId = await getAuthUserId();

    const name = requireString(formData, "name", 100);
    const type = requireString(formData, "type", 10);
    if (type !== "expense" && type !== "income")
      throw new Error("type must be 'expense' or 'income'");

    const category = await createCategory(userId, name, type);

    revalidatePath("/expenses");
    revalidatePath("/income");
    revalidatePath("/transactions");
    revalidatePath("/budgets");
    return { id: category.id };
  } catch (error) {
    return { error: extractError(error) };
  }
}

export async function renameCategoryAction(
  formData: FormData,
): Promise<{ error?: string } | void> {
  try {
    const userId = await getAuthUserId();

    const categoryId = requireString(formData, "categoryId");
    if (!UUID_RE.test(categoryId)) throw new Error("Invalid category ID");
    const name = requireString(formData, "name", 100);

    await renameCategory(userId, categoryId, name);

    revalidatePath("/expenses");
    revalidatePath("/income");
    revalidatePath("/transactions");
    revalidatePath("/budgets");
  } catch (error) {
    return { error: extractError(error) };
  }
}

export async function deleteCategoryAction(
  categoryId: string,
): Promise<{ error?: string } | void> {
  try {
    if (!UUID_RE.test(categoryId)) throw new Error("Invalid category ID");
    const userId = await getAuthUserId();

    await deleteCategory(userId, categoryId);

    revalidatePath("/expenses");
    revalidatePath("/income");
    revalidatePath("/transactions");
    revalidatePath("/budgets");
  } catch (error) {
    return { error: extractError(error) };
  }
}

// ── Transactions ──────────────────────────────────────────────────────────

/** Resolve a user-facing account ID to its underlying ledger account ID. */
export async function createTransactionAction(
  formData: FormData,
): Promise<{ error?: string } | void> {
  try {
    const { id: userId, currency } = await getAuthUser();

    const accountId = requireString(formData, "accountId");
    if (!UUID_RE.test(accountId)) throw new Error("Invalid account ID");
    const categoryAccountId = requireString(formData, "categoryAccountId");
    if (!UUID_RE.test(categoryAccountId))
      throw new Error("Invalid category ID");
    const amount = requireNumber(formData, "amount");
    const description = optionalString(formData, "description");
    if (description && description.length > 500)
      throw new Error("description is too long");
    const date = requireString(formData, "date");
    if (!DATE_RE.test(date)) throw new Error("Invalid date format");
    const notes = optionalString(formData, "notes");
    if (notes && notes.length > 2000) throw new Error("notes is too long");
    const direction = requireString(formData, "direction");

    // accountId and categoryAccountId are both unified accounts.id values — no lookup needed
    // expense: debit=category (expense account), credit=user account (asset/liability)
    // income:  debit=user account (asset/liability), credit=category (income account)
    const debitAccountId =
      direction === "expense" ? categoryAccountId : accountId;
    const creditAccountId =
      direction === "expense" ? accountId : categoryAccountId;

    await createTransaction({
      userId,
      debitAccountId,
      creditAccountId,
      amount: Math.abs(amount),
      description,
      date,
      notes,
      currency,
    });

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
  } catch (error) {
    return { error: extractError(error) };
  }
}

export async function createTransferAction(
  formData: FormData,
): Promise<{ error?: string } | void> {
  try {
    const { id: userId, currency } = await getAuthUser();

    const fromAccountId = requireString(formData, "fromAccountId");
    if (!UUID_RE.test(fromAccountId))
      throw new Error("Invalid source account ID");
    const toAccountId = requireString(formData, "toAccountId");
    if (!UUID_RE.test(toAccountId))
      throw new Error("Invalid destination account ID");
    if (fromAccountId === toAccountId)
      throw new Error("Source and destination must be different accounts");

    const amount = requireNumber(formData, "amount");
    if (amount <= 0) throw new Error("Amount must be positive");
    const description = optionalString(formData, "description");
    if (description && description.length > 500)
      throw new Error("description is too long");
    const date = requireString(formData, "date");
    if (!DATE_RE.test(date)) throw new Error("Invalid date format");
    const notes = optionalString(formData, "notes");
    if (notes && notes.length > 2000) throw new Error("notes is too long");

    // Transfer: debit=destination (money goes in), credit=source (money comes out)
    // Both are unified accounts.id values — no lookup needed
    await createTransaction({
      userId,
      debitAccountId: toAccountId,
      creditAccountId: fromAccountId,
      amount,
      description,
      date,
      notes,
      currency,
    });

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
  } catch (error) {
    return { error: extractError(error) };
  }
}

export async function deleteTransactionAction(
  transactionId: string,
): Promise<{ error?: string } | void> {
  try {
    if (!UUID_RE.test(transactionId)) throw new Error("Invalid transaction ID");
    const userId = await getAuthUserId();
    await deleteTransaction(transactionId, userId);

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
  } catch (error) {
    return { error: extractError(error) };
  }
}

// ── Budgets ───────────────────────────────────────────────────────────────

export async function createBudgetAction(
  formData: FormData,
): Promise<{ error?: string } | void> {
  try {
    const { id: userId, currency } = await getAuthUser();

    const name = requireString(formData, "name", 100);
    const amount = requireNumber(formData, "amount");
    const startDate = requireString(formData, "startDate");
    if (!DATE_RE.test(startDate)) throw new Error("Invalid start date format");
    const endDate = requireString(formData, "endDate");
    if (!DATE_RE.test(endDate)) throw new Error("Invalid end date format");
    const categoryAccountId = requireString(formData, "categoryAccountId");
    if (!UUID_RE.test(categoryAccountId))
      throw new Error("Invalid category ID");

    await createBudget({
      userId,
      name,
      amount,
      startDate,
      endDate,
      categoryAccountId,
      currency,
    });

    revalidatePath("/budgets");
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
  } catch (error) {
    return { error: extractError(error) };
  }
}

// ── Goals ────────────────────────────────────────────────────────────────

export async function createGoalAction(
  formData: FormData,
): Promise<{ error?: string } | void> {
  try {
    const { id: userId, currency } = await getAuthUser();

    const name = requireString(formData, "name", 100);
    const targetAmount = requireNumber(formData, "targetAmount");
    const deadline = optionalString(formData, "deadline");
    if (deadline && !DATE_RE.test(deadline))
      throw new Error("Invalid deadline format");
    const notes = optionalString(formData, "notes");
    if (notes && notes.length > 2000) throw new Error("notes is too long");

    await createGoal({
      userId,
      name,
      targetAmount,
      deadline,
      notes,
      currency,
    });

    revalidatePath("/goals");
    revalidatePath("/dashboard");
  } catch (error) {
    return { error: extractError(error) };
  }
}

export async function fundGoalAction(
  formData: FormData,
): Promise<{ error?: string } | void> {
  try {
    const { id: userId, currency } = await getAuthUser();

    const goalId = requireString(formData, "goalId");
    if (!UUID_RE.test(goalId)) throw new Error("Invalid goal ID");
    const sourceAccountId = requireString(formData, "sourceAccountId");
    if (!UUID_RE.test(sourceAccountId)) throw new Error("Invalid account ID");
    const amount = requireNumber(formData, "amount");
    if (amount <= 0) throw new Error("Amount must be positive");
    const date = requireString(formData, "date");
    if (!DATE_RE.test(date)) throw new Error("Invalid date format");

    await fundGoal(goalId, userId, sourceAccountId, amount, date, currency);

    revalidatePath("/goals");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
  } catch (error) {
    return { error: extractError(error) };
  }
}

// ── Account mutations ───────────────────────────────────────────────────

export async function updateAccountAction(
  formData: FormData,
): Promise<{ error?: string } | void> {
  try {
    const userId = await getAuthUserId();

    const accountId = requireString(formData, "accountId");
    if (!UUID_RE.test(accountId)) throw new Error("Invalid account ID");

    const name = optionalString(formData, "name");
    if (name && name.length > 100) throw new Error("name is too long");
    const type = optionalString(formData, "type");
    if (type && type !== "asset" && type !== "liability")
      throw new Error("type must be 'asset' or 'liability'");
    const institution = optionalString(formData, "institution");
    if (institution && institution.length > 100)
      throw new Error("institution is too long");

    await updateAccount(accountId, userId, {
      ...(name && { name }),
      ...(type && { type: type as "asset" | "liability" }),
      ...(institution !== undefined && { institution }),
    });

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
  } catch (error) {
    return { error: extractError(error) };
  }
}

export async function toggleAccountAction(
  accountId: string,
  isActive: boolean,
): Promise<{ error?: string } | void> {
  try {
    if (!UUID_RE.test(accountId)) throw new Error("Invalid account ID");
    const userId = await getAuthUserId();

    await updateAccount(accountId, userId, { isActive });

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
  } catch (error) {
    return { error: extractError(error) };
  }
}

// ── Transaction mutations ───────────────────────────────────────────────

export async function updateTransactionAction(
  formData: FormData,
): Promise<{ error?: string } | void> {
  try {
    const userId = await getAuthUserId();

    const transactionId = requireString(formData, "transactionId");
    if (!UUID_RE.test(transactionId)) throw new Error("Invalid transaction ID");

    const description = optionalString(formData, "description");
    if (description && description.length > 500)
      throw new Error("description is too long");
    const categoryAccountId = optionalString(formData, "categoryAccountId");
    if (categoryAccountId && !UUID_RE.test(categoryAccountId))
      throw new Error("Invalid category ID");
    const txnType = optionalString(formData, "txnType"); // "expense" or "income"
    const notes = optionalString(formData, "notes");
    if (notes && notes.length > 2000) throw new Error("notes is too long");

    const updates: Parameters<typeof updateTransaction>[2] = {};
    if (description !== undefined) updates.description = description;
    if (notes !== undefined) updates.notes = notes;
    // Category is the debit side for expenses, credit side for income
    if (categoryAccountId) {
      if (txnType === "expense") updates.debitAccountId = categoryAccountId;
      else if (txnType === "income")
        updates.creditAccountId = categoryAccountId;
    }

    await updateTransaction(transactionId, userId, updates);

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
  } catch (error) {
    return { error: extractError(error) };
  }
}

// ── Budget mutations ────────────────────────────────────────────────────

export async function updateBudgetAction(
  formData: FormData,
): Promise<{ error?: string } | void> {
  try {
    const userId = await getAuthUserId();

    const budgetId = requireString(formData, "budgetId");
    if (!UUID_RE.test(budgetId)) throw new Error("Invalid budget ID");

    const name = optionalString(formData, "name");
    if (name && name.length > 100) throw new Error("name is too long");
    const amount = formData.get("amount")
      ? requireNumber(formData, "amount")
      : undefined;
    const startDate = optionalString(formData, "startDate");
    if (startDate && !DATE_RE.test(startDate))
      throw new Error("Invalid start date format");
    const endDate = optionalString(formData, "endDate");
    if (endDate && !DATE_RE.test(endDate))
      throw new Error("Invalid end date format");
    const categoryAccountId = optionalString(formData, "categoryAccountId");
    if (categoryAccountId && !UUID_RE.test(categoryAccountId))
      throw new Error("Invalid category ID");

    await updateBudget(budgetId, userId, {
      ...(name && { name }),
      ...(amount !== undefined && { amount }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(categoryAccountId && { categoryAccountId }),
    });

    revalidatePath("/budgets");
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
  } catch (error) {
    return { error: extractError(error) };
  }
}

export async function toggleBudgetAction(
  budgetId: string,
  isActive: boolean,
): Promise<{ error?: string } | void> {
  try {
    if (!UUID_RE.test(budgetId)) throw new Error("Invalid budget ID");
    const userId = await getAuthUserId();

    await updateBudget(budgetId, userId, { isActive });

    revalidatePath("/budgets");
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
  } catch (error) {
    return { error: extractError(error) };
  }
}

export async function getBudgetDateRangesAction(
  categoryAccountId: string,
  excludeBudgetId?: string,
): Promise<{ data?: BudgetDateRange[]; error?: string }> {
  try {
    if (!UUID_RE.test(categoryAccountId))
      throw new Error("Invalid category ID");
    if (excludeBudgetId && !UUID_RE.test(excludeBudgetId))
      throw new Error("Invalid budget ID");
    const userId = await getAuthUserId();
    const ranges = await getBudgetDateRanges(
      userId,
      categoryAccountId,
      excludeBudgetId,
    );
    return { data: ranges };
  } catch (error) {
    return { error: extractError(error) };
  }
}

// ── Goal mutations ──────────────────────────────────────────────────────

export async function updateGoalAction(
  formData: FormData,
): Promise<{ error?: string } | void> {
  try {
    const { id: userId, currency } = await getAuthUser();

    const goalId = requireString(formData, "goalId");
    if (!UUID_RE.test(goalId)) throw new Error("Invalid goal ID");

    const name = optionalString(formData, "name");
    if (name && name.length > 100) throw new Error("name is too long");
    const targetAmount = formData.get("targetAmount")
      ? requireNumber(formData, "targetAmount")
      : undefined;
    const deadline = optionalString(formData, "deadline");
    if (deadline && !DATE_RE.test(deadline))
      throw new Error("Invalid deadline format");
    const notes = optionalString(formData, "notes");
    if (notes && notes.length > 2000) throw new Error("notes is too long");
    const status = optionalString(formData, "status");

    await updateGoal(goalId, userId, {
      ...(name && { name }),
      ...(targetAmount !== undefined && { targetAmount }),
      ...(deadline && { deadline }),
      ...(notes !== undefined && { notes }),
      ...(status && { status }),
    }, currency);

    revalidatePath("/goals");
    revalidatePath("/dashboard");
  } catch (error) {
    return { error: extractError(error) };
  }
}
