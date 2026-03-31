import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  bigint,
  date,
  jsonb,
  pgEnum,
  integer,
  check,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================================
// ENUM
// ============================================================================

export const ledgerAccountType = pgEnum("ledger_account_type", [
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
]);

// ============================================================================
// AUTH
// ============================================================================

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  name: text(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text(),
  currency: text().notNull().default("USD"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================================
// ACCOUNTS
// Unified table for everything that lives on the chart of accounts:
//   type = asset | liability  →  real-world financial account (bank, card, cash)
//   type = expense | income   →  category (Groceries, Salary, …)
//   type = equity             →  internal (opening balances, retained earnings)
//
// institution and isActive are only meaningful for asset/liability accounts.
// ============================================================================

export const accounts = pgTable(
  "accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    type: ledgerAccountType().notNull(),
    institution: text(),
    currency: text().notNull().default("USD"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("accounts_user_idx").on(t.userId),
    unique("accounts_user_name_unique").on(t.userId, t.name),
  ],
);

// ============================================================================
// DOUBLE-ENTRY BOOKKEEPING
// Never exposed to the AI or UI directly.
// journal_entries  — one row per financial event (the "transaction" users see)
// journal_lines    — the individual debit/credit legs of each entry
//
// Every entry must have lines that sum to zero.
// positive amount = debit, negative amount = credit.
// ============================================================================

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
    description: text(),
    notes: text(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("journal_entries_user_date_idx").on(t.userId, t.date)],
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: uuid().primaryKey().defaultRandom(),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    amount: bigint({ mode: "bigint" }).notNull(), // positive = debit, negative = credit, minor units
  },
  (t) => [
    index("journal_lines_entry_idx").on(t.journalEntryId),
    index("journal_lines_account_idx").on(t.accountId),
  ],
);

// ============================================================================
// BUDGETS & GOALS
// ============================================================================

export const budgets = pgTable(
  "budgets",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    categoryAccountId: uuid("category_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    amount: bigint({ mode: "bigint" }).notNull(), // minor units
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("budgets_user_idx").on(t.userId),
    check("budget_dates_valid", sql`${t.endDate} > ${t.startDate}`),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Hidden asset account that holds the goal's saved funds
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text().notNull(),
    targetAmount: bigint("target_amount", { mode: "bigint" }).notNull(), // minor units
    deadline: date(),
    notes: text(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("goals_user_idx").on(t.userId),
    index("goals_account_idx").on(t.accountId),
  ],
);

// ============================================================================
// AI — Conversations, Messages, Memory
// ============================================================================

export const conversations = pgTable(
  "conversations",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("conversations_user_idx").on(t.userId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text().notNull(),
    content: text(),
    parts: jsonb(),
    toolCalls: jsonb("tool_calls"),
    toolResults: jsonb("tool_results"),
    tokenCount: integer("token_count"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("messages_conversation_idx").on(t.conversationId),
    check(
      "messages_role_check",
      sql`${t.role} IN ('user', 'assistant', 'tool')`,
    ),
  ],
);

export const memories = pgTable(
  "memories",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text().notNull(),
    tags: text().array(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("memories_user_idx").on(t.userId)],
);

// ============================================================================
// INFRA — Rate limiting, Email verification
// ============================================================================

export const rateLimitAttempts = pgTable("rate_limit_attempts", {
  key: text().primaryKey(),
  count: integer().notNull().default(1),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export const emailVerificationCodes = pgTable(
  "email_verification_codes",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text().notNull(),
    code: text().notNull(),
    attempts: integer().notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("email_verification_user_idx").on(t.userId)],
);

// ============================================================================
// FX — Cached daily exchange rates from ECB (via frankfurter.app)
// ============================================================================

export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid().primaryKey().defaultRandom(),
    baseCurrency: text("base_currency").notNull(), // "USD" from OXR (was "EUR" from ECB)
    date: date().notNull(),
    rates: jsonb().$type<Record<string, number>>().notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("exchange_rates_base_date_unique").on(t.baseCurrency, t.date),
    index("exchange_rates_date_idx").on(t.date),
  ],
);
