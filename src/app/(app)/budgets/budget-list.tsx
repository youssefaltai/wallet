"use client";

import { useState } from "react";
import { useErrorDialog } from "@/hooks/use-error-dialog";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  createBudgetAction,
  updateBudgetAction,
  toggleBudgetAction,
} from "../actions";
import { AnimateIn } from "@/components/shared/animate-in";
import {
  PencilIcon,
  PowerIcon,
} from "lucide-react";
import type { BudgetStatus } from "@/lib/services/budgets";
import type { Category } from "@/lib/services/categories";
import { formatDateRange } from "@/lib/utils/format-date";

export function BudgetList({
  budgets,
  expenseCategories,
  currency = "USD",
}: {
  budgets: BudgetStatus[];
  expenseCategories: Category[];
  currency?: string;
}) {
  const { showError, ErrorDialog } = useErrorDialog();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetStatus | null>(null);

  const activeBudgets = budgets.filter((b) => b.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          {activeBudgets.length} active budget{activeBudgets.length !== 1 && "s"}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>Add Budget</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Budget</DialogTitle>
            </DialogHeader>
            <form
              action={async (formData) => {
                const result = await createBudgetAction(formData);
                if (result?.error) {
                  showError(result.error);
                  return;
                }
                setOpen(false);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Budget Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. Monthly Groceries"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <MoneyInput
                  id="amount"
                  name="amount"
                  placeholder="500.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryAccountId">Expense Category</Label>
                <Select name="categoryAccountId" required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an expense category">
                      {(value: string) => {
                        const cat = expenseCategories.find((c) => c.id === value);
                        return cat?.name ?? "Select an expense category";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <DatePicker
                    id="startDate"
                    name="startDate"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <DatePicker
                    id="endDate"
                    name="endDate"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">
                Create Budget
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {budgets.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No budgets for this period.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget, i) => {
            const barColor =
              budget.percentUsed >= 90
                ? "bg-negative"
                : budget.percentUsed >= 75
                  ? "bg-warning"
                  : "bg-positive";

            return (
              <AnimateIn key={budget.id} delay={i * 50}>
                <ContextMenu>
                  <ContextMenuTrigger>
                    <Card className="cursor-pointer">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">
                          {budget.name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {budget.categoryName && (
                            <Badge variant="secondary">{budget.categoryName}</Badge>
                          )}
                          {!budget.isActive && (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
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
                      </CardContent>
                    </Card>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() => {
                        setEditingBudget(budget);
                        setEditOpen(true);
                      }}
                    >
                      <PencilIcon />
                      Edit Budget
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={async () => {
                        if (budget.isActive) {
                          if (!(await confirm(`Deactivate the budget "${budget.name}"? It will no longer track spending.`))) return;
                        }
                        const result = await toggleBudgetAction(
                          budget.id,
                          !budget.isActive
                        );
                        if (result?.error) showError(result.error);
                      }}
                    >
                      <PowerIcon />
                      {budget.isActive ? "Deactivate" : "Activate"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </AnimateIn>
            );
          })}
        </div>
      )}

      <ConfirmDialog />
      <ErrorDialog />

      {/* Edit Budget Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Budget</DialogTitle>
          </DialogHeader>
          {editingBudget && (
            <form
              action={async (formData) => {
                const result = await updateBudgetAction(formData);
                if (result?.error) {
                  showError(result.error);
                  return;
                }
                setEditOpen(false);
                setEditingBudget(null);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="budgetId" value={editingBudget.id} />
              <div className="space-y-2">
                <Label htmlFor="edit-budget-name">Budget Name</Label>
                <Input
                  id="edit-budget-name"
                  name="name"
                  defaultValue={editingBudget.name}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-budget-amount">Amount</Label>
                <MoneyInput
                  id="edit-budget-amount"
                  name="amount"
                  defaultValue={editingBudget.budgetAmount.toFixed(2)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-budget-category">Expense Category</Label>
                <Select
                  name="categoryAccountId"
                  defaultValue={editingBudget.categoryAccountId}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an expense category">
                      {(value: string) => {
                        const cat = expenseCategories.find((c) => c.id === value);
                        return cat?.name ?? "Select an expense category";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-budget-start">Start Date</Label>
                  <DatePicker
                    id="edit-budget-start"
                    name="startDate"
                    defaultValue={editingBudget.startDate}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-budget-end">End Date</Label>
                  <DatePicker
                    id="edit-budget-end"
                    name="endDate"
                    defaultValue={editingBudget.endDate}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">
                Save Changes
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
