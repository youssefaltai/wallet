"use client";

import { useState } from "react";
import { useErrorDialog } from "@/hooks/use-error-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  createGoalAction,
  updateGoalAction,
} from "../actions";
import { AnimateIn } from "@/components/shared/animate-in";
import { CurrencySelect } from "@/components/shared/currency-select";
import { QuickFundDialog } from "./quick-fund-dialog";
import { formatDateFull } from "@/lib/utils/format-date";
import {
  PencilIcon,
  WalletIcon,
} from "lucide-react";
import type { GoalWithProgress } from "@/lib/services/goals";
import type { AccountWithBalance } from "@/lib/services/accounts";

export function GoalList({
  goals,
  fundingAccounts,
}: {
  goals: GoalWithProgress[];
  fundingAccounts: AccountWithBalance[];
}) {
  const { showError, ErrorDialog } = useErrorDialog();
  const [open, setOpen] = useState(false);
  const [fundGoalId, setFundGoalId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalWithProgress | null>(null);
  const [createCurrency, setCreateCurrency] = useState<string | undefined>();

  const fundingGoal = fundGoalId
    ? goals.find((g) => g.id === fundGoalId) ?? null
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          {goals.length} goal{goals.length !== 1 && "s"}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>Add Goal</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Goal</DialogTitle>
            </DialogHeader>
            <form
              action={async (formData) => {
                const result = await createGoalAction(formData);
                if (result?.error) {
                  showError(result.error);
                  return;
                }
                setOpen(false);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Goal Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. Emergency Fund"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-currency">Currency</Label>
                <CurrencySelect
                  id="goal-currency"
                  onChange={setCreateCurrency}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetAmount">Target Amount</Label>
                <MoneyInput
                  id="targetAmount"
                  name="targetAmount"
                  currencyCode={createCurrency}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline (optional)</Label>
                <DatePicker
                  id="deadline"
                  name="deadline"
                  placeholder="No deadline"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Any additional details..."
                  rows={2}
                />
              </div>
              <Button type="submit" className="w-full">
                Create Goal
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No goals for this period.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal, i) => (
            <AnimateIn key={goal.id} delay={i * 50}>
              <ContextMenu>
                <ContextMenuTrigger>
                  <Card className="cursor-pointer">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium truncate">
                        {goal.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-bold">
                          {goal.currentAmountFormatted}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          of {goal.targetAmountFormatted}
                        </span>
                      </div>

                      <ProgressBar
                        value={goal.progressPercent}
                        className="mt-3 overflow-hidden"
                        barClassName="bg-primary transition-all"
                      />
                      <p className="mt-1 text-xs text-muted-foreground text-right">
                        {goal.progressPercent}%
                      </p>

                      <div className="mt-1 space-y-0.5">
                        {goal.deadline && (
                          <p className="text-xs text-muted-foreground">
                            Deadline:{" "}
                            {formatDateFull(goal.deadline)}
                          </p>
                        )}
                        {goal.notes && (
                          <p className="text-xs text-muted-foreground">{goal.notes}</p>
                        )}
                      </div>

                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-auto py-0.5 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setFundGoalId(goal.id);
                          }}
                        >
                          <WalletIcon className="size-3" data-icon="inline-start" />
                          Quick Fund
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    onClick={() => setFundGoalId(goal.id)}
                  >
                    <WalletIcon />
                    Quick Fund
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={() => {
                      setEditingGoal(goal);
                      setEditOpen(true);
                    }}
                  >
                    <PencilIcon />
                    Edit Goal
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </AnimateIn>
          ))}
        </div>
      )}

      {fundingGoal && (
        <QuickFundDialog
          goal={fundingGoal}
          accounts={fundingAccounts}
          open={!!fundGoalId}
          onOpenChange={(open) => {
            if (!open) setFundGoalId(null);
          }}
        />
      )}

      <ErrorDialog />

      {/* Edit Goal Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>
          {editingGoal && (
            <form
              action={async (formData) => {
                const result = await updateGoalAction(formData);
                if (result?.error) {
                  showError(result.error);
                  return;
                }
                setEditOpen(false);
                setEditingGoal(null);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="goalId" value={editingGoal.id} />
              <div className="space-y-2">
                <Label htmlFor="edit-goal-name">Goal Name</Label>
                <Input
                  id="edit-goal-name"
                  name="name"
                  defaultValue={editingGoal.name}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-goal-target">Target Amount</Label>
                <MoneyInput
                  id="edit-goal-target"
                  name="targetAmount"
                  defaultValue={editingGoal.targetAmount.toFixed(2)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-goal-deadline">Deadline (optional)</Label>
                <DatePicker
                  id="edit-goal-deadline"
                  name="deadline"
                  defaultValue={editingGoal.deadline ?? ""}
                  placeholder="No deadline"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-goal-notes">Notes (optional)</Label>
                <Textarea
                  id="edit-goal-notes"
                  name="notes"
                  defaultValue={editingGoal.notes ?? ""}
                  rows={2}
                />
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
