import type { ComponentType } from "react";
import { AccountsCard } from "./accounts-card";
import { TransactionsCard } from "./transactions-card";
import { SpendingSummaryCard } from "./spending-summary-card";
import { IncomeSummaryCard } from "./income-summary-card";
import { BudgetStatusCard } from "./budget-status-card";
import { GoalsCard } from "./goals-card";
import { NetWorthCard } from "./net-worth-card";
import { CashFlowCard } from "./cash-flow-card";
import { CreateAccountCard } from "./create-account-card";
import { CreateTransactionCard } from "./create-transaction-card";
import { CreateBudgetCard } from "./create-budget-card";
import { CreateGoalCard } from "./create-goal-card";
import { GoalFundCard } from "./fund-goal-card";
import { MutationSuccessCard } from "./mutation-success-card";
import { ConvertCurrencyCard } from "./convert-currency-card";
import { BatchResultCard } from "./batch-result-card";

type CardComponent = ComponentType<{ output: unknown; toolName?: string }>;

export const toolCardRegistry: Record<string, CardComponent> = {
  // Read tools
  get_accounts: AccountsCard,
  get_transactions: TransactionsCard,
  get_spending_summary: SpendingSummaryCard,
  get_income_summary: IncomeSummaryCard,
  get_budget_status: BudgetStatusCard,
  get_goals: GoalsCard,
  get_net_worth: NetWorthCard,
  get_cash_flow: CashFlowCard,
  convert_currency: ConvertCurrencyCard,

  // Write tools — specific cards for creates
  create_asset_account: CreateAccountCard,
  create_liability: CreateAccountCard,
  record_expense: CreateTransactionCard,
  record_income: CreateTransactionCard,
  record_transfer: CreateTransactionCard,
  create_budget: CreateBudgetCard,
  create_goal: CreateGoalCard,

  // Write tools — goal funding
  fund_goal: GoalFundCard,
  withdraw_from_goal: GoalFundCard,

  // Write tools — expense category management
  create_expense_category: MutationSuccessCard,
  rename_expense_category: MutationSuccessCard,
  delete_expense_category: MutationSuccessCard,

  // Write tools — income source management
  create_income_source: MutationSuccessCard,
  rename_income_source: MutationSuccessCard,
  delete_income_source: MutationSuccessCard,

  // Write tools — batch operations
  batch_create_transactions: BatchResultCard,
  batch_delete_transactions: BatchResultCard,
  batch_create_budgets: BatchResultCard,
  batch_fund_goals: BatchResultCard,
  batch_create_goals: BatchResultCard,
  batch_create_accounts: BatchResultCard,

  // Write tools — generic success for updates/deletes
  update_account: MutationSuccessCard,
  update_transaction: MutationSuccessCard,
  delete_transaction: MutationSuccessCard,
  update_budget: MutationSuccessCard,
  update_goal: MutationSuccessCard,
};
