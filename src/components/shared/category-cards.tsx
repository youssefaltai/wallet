"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useErrorDialog } from "@/hooks/use-error-dialog";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  deleteCategoryAction,
  toggleBudgetAction,
} from "@/app/(app)/actions";
import type { CategoryWithTotal } from "@/lib/services/categories";
import type { BudgetStatus } from "@/lib/services/budgets";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowUpRightIcon,
  ArrowDownLeftIcon,
  ArrowRightIcon,
  PiggyBankIcon,
  PowerIcon,
} from "lucide-react";
import { AnimateIn } from "@/components/shared/animate-in";
import { formatDateRange } from "@/lib/utils/format-date";
import { getCurrentDate } from "@/lib/utils/date";
import { CreateCategoryDialog } from "@/components/shared/create-category-dialog";
import { RenameCategoryDialog } from "@/components/shared/rename-category-dialog";
import { CreateBudgetDialog } from "@/components/shared/create-budget-dialog";
import { EditBudgetDialog } from "@/components/shared/edit-budget-dialog";

const TYPE_CONFIG = {
  expense: {
    icon: ArrowUpRightIcon,
    label: "spent",
  },
  income: {
    icon: ArrowDownLeftIcon,
    label: "earned",
  },
} as const;

export function CategoryCards({
  categories,
  type,
  createLabel,
  emptyMessage,
  placeholder,
  currency,
  budgets,
  periodStart,
  periodEnd,
}: {
  categories: CategoryWithTotal[];
  type: "expense" | "income";
  createLabel: string;
  emptyMessage: string;
  placeholder: string;
  currency: string;
  budgets?: BudgetStatus[];
  periodStart?: string;
  periodEnd?: string;
}) {
  const { icon: Icon, label: amountLabel } = TYPE_CONFIG[type];
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showError, ErrorDialog } = useErrorDialog();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  function transactionsUrl(categoryId: string) {
    const params = new URLSearchParams();
    params.set("category", categoryId);
    const date = searchParams.get("date");
    if (date) params.set("date", date);
    return `/transactions?${params.toString()}`;
  }

  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renamingCategory, setRenamingCategory] = useState<CategoryWithTotal | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState<CategoryWithTotal | null>(null);
  const [editBudgetOpen, setEditBudgetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetStatus | null>(null);

  // Build a map of categoryAccountId -> BudgetStatus for quick lookup.
  // Only include budgets whose date range contains the selected day.
  const selectedDay = searchParams.get("date") ?? getCurrentDate();
  const budgetByCategoryId = new Map<string, BudgetStatus>();
  if (budgets) {
    for (const b of budgets) {
      if (b.isActive && selectedDay >= b.startDate && selectedDay <= b.endDate) {
        budgetByCategoryId.set(b.categoryAccountId, b);
      }
    }
  }

  const totalAmount = categories.reduce((sum, c) => sum + c.total, 0);
  const totalFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(totalAmount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Total {amountLabel}:{" "}
          <span className="font-semibold text-foreground">{totalFormatted}</span>
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" data-icon="inline-start" />
          {createLabel}
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {emptyMessage}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat, i) => {
            const budget = budgetByCategoryId.get(cat.id);
            const barColor = budget
              ? budget.percentUsed >= 90
                ? "bg-negative"
                : budget.percentUsed >= 75
                  ? "bg-warning"
                  : "bg-positive"
              : undefined;

            return (
              <AnimateIn key={cat.id} delay={i * 50}>
                <ContextMenu>
                  <ContextMenuTrigger>
                    <Card
                      className="cursor-pointer"
                      onClick={() => router.push(transactionsUrl(cat.id))}
                    >
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">
                          {cat.name}
                        </CardTitle>
                        <Icon className="size-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {budget ? (
                          <>
                            <div className="flex items-baseline justify-between">
                              <span className="text-2xl font-bold">
                                {budget.spentFormatted}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                of {budget.budgetAmountFormatted}
                              </span>
                            </div>
                            <ProgressBar
                              value={budget.percentUsed}
                              className="overflow-hidden"
                              barClassName={`${barColor} transition-all`}
                            />
                            <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                              <span>
                                {budget.remaining >= 0
                                  ? `${budget.remainingFormatted} left`
                                  : `${new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Math.abs(budget.remaining))} over`}
                                {" \u00B7 "}
                                {Math.round(budget.percentUsed)}% used
                              </span>
                              <span>
                                {formatDateRange(budget.startDate, budget.endDate)}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-baseline justify-between">
                              <span className="text-2xl font-bold">
                                {cat.totalFormatted}
                              </span>
                            </div>
                            <ProgressBar
                              value={0}
                              className="overflow-hidden invisible"
                              barClassName="transition-all"
                            />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{amountLabel} this month</span>
                              {type === "expense" && periodStart && periodEnd && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-auto -my-[3px] py-0.5 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBudgetCategory(cat);
                                    setBudgetDialogOpen(true);
                                  }}
                                >
                                  <PiggyBankIcon className="size-3" data-icon="inline-start" />
                                  Set Budget
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() => router.push(transactionsUrl(cat.id))}
                    >
                      <ArrowRightIcon />
                      View Transactions
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => {
                        setRenamingCategory(cat);
                        setRenameOpen(true);
                      }}
                    >
                      <PencilIcon />
                      Rename
                    </ContextMenuItem>
                    {budget && (
                      <>
                        <ContextMenuItem
                          onClick={() => {
                            setEditingBudget(budget);
                            setEditBudgetOpen(true);
                          }}
                        >
                          <PiggyBankIcon />
                          Edit Budget
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={async () => {
                            if (!(await confirm(`Deactivate the budget "${budget.name}"? It will no longer track spending.`))) return;
                            const result = await toggleBudgetAction(budget.id, !budget.isActive);
                            if (result?.error) showError(result.error);
                          }}
                        >
                          <PowerIcon />
                          Deactivate Budget
                        </ContextMenuItem>
                      </>
                    )}
                    {!budget && type === "expense" && periodStart && periodEnd && (
                      <ContextMenuItem
                        onClick={() => {
                          setBudgetCategory(cat);
                          setBudgetDialogOpen(true);
                        }}
                      >
                        <PiggyBankIcon />
                        Set Budget
                      </ContextMenuItem>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      onClick={async () => {
                        if (!(await confirm(`Delete the category "${cat.name}"? Any transactions in this category will become uncategorized.`))) return;
                        const result = await deleteCategoryAction(cat.id);
                        if (result?.error) showError(result.error);
                      }}
                    >
                      <TrashIcon />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </AnimateIn>
            );
          })}
        </div>
      )}

      <CreateCategoryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        type={type}
        onSuccess={() => {}}
        createLabel={createLabel}
        placeholder={placeholder}
      />

      <RenameCategoryDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        category={renamingCategory}
        onSuccess={() => setRenamingCategory(null)}
      />

      <CreateBudgetDialog
        open={budgetDialogOpen}
        onOpenChange={setBudgetDialogOpen}
        category={budgetCategory}
        onSuccess={() => setBudgetCategory(null)}
      />

      <EditBudgetDialog
        open={editBudgetOpen}
        onOpenChange={setEditBudgetOpen}
        budget={editingBudget}
        onSuccess={() => setEditingBudget(null)}
      />

      <ConfirmDialog />
      <ErrorDialog />
    </div>
  );
}
