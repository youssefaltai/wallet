"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useErrorDialog } from "@/hooks/use-error-dialog";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Landmark, CreditCard, ArrowLeft, ArrowRightIcon, PencilIcon, PowerIcon, WalletIcon, SlidersHorizontalIcon } from "lucide-react";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  createAccountAction,
  updateAccountAction,
  toggleAccountAction,
  adjustAccountBalanceAction,
} from "../actions";
import { AnimateIn } from "@/components/shared/animate-in";
import { QuickPayDialog } from "@/components/shared/quick-pay-dialog";
import type { AccountWithBalance } from "@/lib/services/accounts";
import { CurrencySelect } from "@/components/shared/currency-select";

/** Friendly labels for the two account types. */
const TYPE_META = {
  asset: {
    label: "Bank & Cash",
    description: "Checking, savings, cash, investments — anything you own",
    icon: Landmark,
  },
  liability: {
    label: "Credit & Loans",
    description: "Credit cards, mortgages, student loans — anything you owe",
    icon: CreditCard,
  },
} as const;

type AccountType = "asset" | "liability";

export function AccountList({
  accounts,
  currency = "USD",
  totalFormatted,
  dateParam,
}: {
  accounts: AccountWithBalance[];
  currency?: string;
  totalFormatted: string;
  dateParam?: string | null;
}) {
  const router = useRouter();
  const { showError, ErrorDialog } = useErrorDialog();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  function transactionsUrl(accountId: string) {
    const params = new URLSearchParams();
    params.set("account", accountId);
    if (dateParam) params.set("date", dateParam);
    return `/transactions?${params.toString()}`;
  }
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<AccountType | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithBalance | null>(null);
  const [payAccountId, setPayAccountId] = useState<string | null>(null);
  const [adjustingAccount, setAdjustingAccount] = useState<AccountWithBalance | null>(null);

  const assetAccounts = useMemo(
    () => accounts.filter((a) => a.type === "asset" && a.isActive),
    [accounts]
  );
  const payAccount = payAccountId
    ? accounts.find((a) => a.id === payAccountId) ?? null
    : null;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setSelectedType(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Total balance:{" "}
          <span className="font-semibold text-foreground">
            {totalFormatted}
          </span>
        </p>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger render={<Button />}>Add Account</DialogTrigger>
          <DialogContent>
            {selectedType === null ? (
              <>
                <DialogHeader>
                  <DialogTitle>What kind of account?</DialogTitle>
                  <DialogDescription>
                    Pick the type that best describes this account.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  {(Object.entries(TYPE_META) as [AccountType, typeof TYPE_META[AccountType]][]).map(
                    ([type, meta]) => {
                      const Icon = meta.icon;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSelectedType(type)}
                          className="flex items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <Icon className="size-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium">{meta.label}</div>
                            <div className="text-sm text-muted-foreground">
                              {meta.description}
                            </div>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedType(null)}
                      className="inline-flex items-center justify-center rounded-md p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Go back"
                    >
                      <ArrowLeft className="size-4" />
                    </button>
                    {TYPE_META[selectedType].label}
                  </DialogTitle>
                </DialogHeader>
                <form
                  action={async (formData) => {
                    const result = await createAccountAction(formData);
                    if (result?.error) {
                      showError(result.error);
                      return;
                    }
                    handleOpenChange(false);
                  }}
                  className="space-y-4"
                >
                  <input type="hidden" name="type" value={selectedType} />
                  <div className="space-y-2">
                    <Label htmlFor="name">Account Name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder={
                        selectedType === "asset"
                          ? "e.g. Chase Checking"
                          : "e.g. Visa Platinum"
                      }
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="institution">Institution (optional)</Label>
                    <Input
                      id="institution"
                      name="institution"
                      placeholder={
                        selectedType === "asset"
                          ? "e.g. Chase, Vanguard"
                          : "e.g. Capital One, SoFi"
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <CurrencySelect
                      id="currency"
                      name="currency"
                      defaultValue={currency}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="initialBalance">Starting Balance (optional)</Label>
                    <Input
                      id="initialBalance"
                      name="initialBalance"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Create Account
                  </Button>
                </form>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No accounts yet. Add your first account to get started.
          </CardContent>
        </Card>
      ) : (
        <>
          {(["asset", "liability"] as const).map((type) => {
            const group = accounts.filter((a) => a.type === type);
            if (group.length === 0) return null;
            const meta = TYPE_META[type];
            const Icon = meta.icon;
            return (
              <div key={type} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="size-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">{meta.label}</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.map((account, i) => (
                    <AnimateIn key={account.id} delay={i * 50}>
                      <ContextMenu>
                        <ContextMenuTrigger>
                          <Card
                            className="cursor-pointer"
                            onClick={() => router.push(transactionsUrl(account.id))}
                          >
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                              <CardTitle className="text-sm font-medium">
                                {account.name}
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                {account.currency !== currency && (
                                  <Badge variant="secondary">{account.currency}</Badge>
                                )}
                                {!account.isActive && (
                                  <Badge variant="outline">Inactive</Badge>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">
                                {account.balanceFormatted}
                              </div>
                              {account.institution && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {account.institution}
                                </p>
                              )}
                              {account.type === "liability" && (
                                <div className="mt-3 flex justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-auto py-0.5 px-2 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setPayAccountId(account.id);
                                    }}
                                  >
                                    <WalletIcon className="size-3" data-icon="inline-start" />
                                    Quick Pay
                                  </Button>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={() => router.push(transactionsUrl(account.id))}
                          >
                            <ArrowRightIcon />
                            View Transactions
                          </ContextMenuItem>
                          {account.type === "liability" && (
                            <>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onClick={() => setPayAccountId(account.id)}
                              >
                                <WalletIcon />
                                Quick Pay
                              </ContextMenuItem>
                            </>
                          )}
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            onClick={() => {
                              setEditingAccount(account);
                              setEditOpen(true);
                            }}
                          >
                            <PencilIcon />
                            Edit Account
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => setAdjustingAccount(account)}
                          >
                            <SlidersHorizontalIcon />
                            Adjust Balance
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={async () => {
                              if (account.isActive) {
                                if (!(await confirm(`Deactivate "${account.name}"? It will be hidden from balances and transaction forms.`))) return;
                              }
                              const result = await toggleAccountAction(
                                account.id,
                                !account.isActive
                              );
                              if (result?.error) showError(result.error);
                            }}
                          >
                            <PowerIcon />
                            {account.isActive ? "Deactivate" : "Activate"}
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </AnimateIn>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      <ConfirmDialog />
      <ErrorDialog />

      {payAccount && (
        <QuickPayDialog
          account={payAccount}
          sourceAccounts={assetAccounts}
          open={!!payAccountId}
          onOpenChange={(open) => {
            if (!open) setPayAccountId(null);
          }}
        />
      )}

      {/* Adjust Balance Dialog */}
      <Dialog open={!!adjustingAccount} onOpenChange={(open) => { if (!open) setAdjustingAccount(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Balance</DialogTitle>
          </DialogHeader>
          {adjustingAccount && (
            <form
              action={async (formData) => {
                const raw = formData.get("newBalance");
                const newBalance = typeof raw === "string" ? parseFloat(raw) : NaN;
                if (isNaN(newBalance) || newBalance < 0) {
                  showError("Please enter a valid non-negative balance.");
                  return;
                }
                const result = await adjustAccountBalanceAction(adjustingAccount.id, newBalance);
                if (result?.error) {
                  showError(result.error);
                  return;
                }
                setAdjustingAccount(null);
                router.refresh();
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Current balance</p>
                <p className="text-xl font-semibold">{adjustingAccount.balanceFormatted}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjust-balance">New Balance ({adjustingAccount.currency})</Label>
                <Input
                  id="adjust-balance"
                  name="newBalance"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Apply Adjustment
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          {editingAccount && (
            <form
              action={async (formData) => {
                const result = await updateAccountAction(formData);
                if (result?.error) {
                  showError(result.error);
                  return;
                }
                setEditOpen(false);
                setEditingAccount(null);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="accountId" value={editingAccount.id} />
              <div className="space-y-2">
                <Label htmlFor="edit-name">Account Name</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={editingAccount.name}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-institution">Institution (optional)</Label>
                <Input
                  id="edit-institution"
                  name="institution"
                  defaultValue={editingAccount.institution ?? ""}
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
