"use client";

import { useState } from "react";
import { useErrorDialog } from "@/hooks/use-error-dialog";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TransactionTable } from "@/components/shared/transaction-table";
import {
  createTransactionAction,
  createTransferAction,
  createCategoryAction,
  deleteTransactionAction,
  updateTransactionAction,
} from "../actions";
import type { AccountWithBalance } from "@/lib/services/accounts";
import type { TransactionRow } from "@/lib/services/transactions";
import type { Category } from "@/lib/services/categories";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ArrowLeftRightIcon,
  PlusIcon,
} from "lucide-react";

type TransactionType = "expense" | "income" | "transfer" | null;

function TypeSelectorMenu({
  onSelect,
}: {
  onSelect: (type: TransactionType) => void;
}) {
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        What kind of transaction would you like to add?
      </p>
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={() => onSelect("expense")}
          className="flex items-center gap-3 rounded-lg border border-input p-3 text-left transition-colors hover:bg-muted"
        >
          <ArrowUpRightIcon className="size-5 shrink-0 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Expense</div>
            <div className="text-xs text-muted-foreground">
              Money going out
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onSelect("income")}
          className="flex items-center gap-3 rounded-lg border border-input p-3 text-left transition-colors hover:bg-muted"
        >
          <ArrowDownLeftIcon className="size-5 shrink-0 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Income</div>
            <div className="text-xs text-muted-foreground">
              Money coming in
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onSelect("transfer")}
          className="flex items-center gap-3 rounded-lg border border-input p-3 text-left transition-colors hover:bg-muted"
        >
          <ArrowLeftRightIcon className="size-5 shrink-0 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Transfer</div>
            <div className="text-xs text-muted-foreground">
              Move money between accounts
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

function GroupedAccountSelect({
  accounts,
  name,
  defaultValue,
  placeholder,
  showBalance,
}: {
  accounts: AccountWithBalance[];
  name: string;
  defaultValue?: string;
  placeholder: string;
  showBalance?: boolean;
}) {
  const assetAccounts = accounts.filter((a) => a.type === "asset");
  const liabilityAccounts = accounts.filter((a) => a.type === "liability");
  const allAccounts = [...assetAccounts, ...liabilityAccounts];

  const formatLabel = (a: AccountWithBalance) =>
    showBalance ? `${a.name} (${a.balanceFormatted})` : a.name;

  return (
    <Select name={name} required defaultValue={defaultValue ?? allAccounts[0]?.id}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {(value: string) => {
            const acct = allAccounts.find((a) => a.id === value);
            return acct ? formatLabel(acct) : value;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {assetAccounts.length > 0 && liabilityAccounts.length > 0 ? (
          <>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Bank &amp; Cash
            </div>
            {assetAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {formatLabel(a)}
              </SelectItem>
            ))}
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Credit &amp; Loans
            </div>
            {liabilityAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {formatLabel(a)}
              </SelectItem>
            ))}
          </>
        ) : (
          allAccounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {formatLabel(a)}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

/** Category select with inline "Create new..." option. */
function CategorySelect({
  categories,
  name,
  label,
  type,
  defaultValue,
  onCreated,
  onError,
}: {
  categories: Category[];
  name: string;
  label: string;
  type: "expense" | "income";
  defaultValue?: string;
  onCreated?: (cat: Category) => void;
  onError: (msg: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (creating) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={type === "expense" ? "e.g. Groceries" : "e.g. Salary"}
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            disabled={submitting || !newName.trim()}
            onClick={async () => {
              setSubmitting(true);
              const fd = new FormData();
              fd.set("name", newName.trim());
              fd.set("type", type);
              const result = await createCategoryAction(fd);
              setSubmitting(false);
              if (result?.error) {
                onError(result.error);
                return;
              }
              if (result?.id) {
                onCreated?.({ id: result.id, name: newName.trim(), type });
              }
              setCreating(false);
              setNewName("");
            }}
          >
            {submitting ? "..." : "Add"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select name={name} required defaultValue={defaultValue ?? categories[0]?.id}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`}>
            {(value: string) => {
              if (value === "__create__") return "Create new...";
              const cat = categories.find((c) => c.id === value);
              return cat?.name ?? value;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
          {categories.length > 0 && (
            <div className="border-t my-1" />
          )}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="relative flex w-full cursor-pointer items-center rounded-sm py-1.5 px-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <PlusIcon className="size-3.5 mr-2" />
            Create new...
          </button>
        </SelectContent>
      </Select>
    </div>
  );
}

function ExpenseForm({
  accounts,
  categories: initialCategories,
  onClose,
  onBack,
  onError,
}: {
  accounts: AccountWithBalance[];
  categories: Category[];
  onClose: () => void;
  onBack: () => void;
  onError: (message: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState(initialCategories);

  if (categories.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You need at least one expense category. Create one first on the Categories page.
        </p>
        <CategorySelect
          categories={categories}
          name="categoryAccountId"
          label="Category"
          type="expense"
          onCreated={(cat) => setCategories((prev) => [...prev, cat])}
          onError={onError}
        />
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <form
      action={async (formData) => {
        setSubmitting(true);
        formData.set("direction", "expense");
        const result = await createTransactionAction(formData);
        setSubmitting(false);
        if (result?.error) {
          onError(result.error);
          return;
        }
        onClose();
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label>Paid from</Label>
        <GroupedAccountSelect
          accounts={accounts}
          name="accountId"
          placeholder="Select account"
          showBalance
        />
      </div>
      <CategorySelect
        categories={categories}
        name="categoryAccountId"
        label="Category"
        type="expense"
        onCreated={(cat) => setCategories((prev) => [...prev, cat])}
        onError={onError}
      />
      <div className="space-y-2">
        <Label htmlFor="expense-amount">Amount</Label>
        <MoneyInput
          id="expense-amount"
          name="amount"
          placeholder="0.00"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="expense-description">Description (optional)</Label>
        <Input
          id="expense-description"
          name="description"
          placeholder="e.g. Grocery store"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="expense-date">Date</Label>
        <DatePicker
          id="expense-date"
          name="date"
          required
          defaultValue={new Date().toISOString().split("T")[0]}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="expense-notes">Notes (optional)</Label>
        <Textarea
          id="expense-notes"
          name="notes"
          placeholder="Any additional details..."
          className="min-h-12"
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? "Adding..." : "Add Expense"}
        </Button>
      </div>
    </form>
  );
}

function IncomeForm({
  accounts,
  categories: initialCategories,
  onClose,
  onBack,
  onError,
}: {
  accounts: AccountWithBalance[];
  categories: Category[];
  onClose: () => void;
  onBack: () => void;
  onError: (message: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState(initialCategories);
  const depositAccounts = accounts.filter((a) => a.type === "asset");

  if (depositAccounts.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You need at least one bank or cash account to receive income.
        </p>
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You need at least one income source. Create one first.
        </p>
        <CategorySelect
          categories={categories}
          name="categoryAccountId"
          label="Source"
          type="income"
          onCreated={(cat) => setCategories((prev) => [...prev, cat])}
          onError={onError}
        />
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <form
      action={async (formData) => {
        setSubmitting(true);
        formData.set("direction", "income");
        const result = await createTransactionAction(formData);
        setSubmitting(false);
        if (result?.error) {
          onError(result.error);
          return;
        }
        onClose();
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label>Deposit to</Label>
        <Select name="accountId" required defaultValue={depositAccounts[0]?.id}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select account">
              {(value: string) => {
                const acct = depositAccounts.find((a) => a.id === value);
                return acct
                  ? `${acct.name} (${acct.balanceFormatted})`
                  : value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {depositAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name} ({a.balanceFormatted})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <CategorySelect
        categories={categories}
        name="categoryAccountId"
        label="Source"
        type="income"
        onCreated={(cat) => setCategories((prev) => [...prev, cat])}
        onError={onError}
      />
      <div className="space-y-2">
        <Label htmlFor="income-amount">Amount</Label>
        <MoneyInput
          id="income-amount"
          name="amount"
          placeholder="0.00"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="income-description">Description (optional)</Label>
        <Input
          id="income-description"
          name="description"
          placeholder="e.g. March paycheck"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="income-date">Date</Label>
        <DatePicker
          id="income-date"
          name="date"
          required
          defaultValue={new Date().toISOString().split("T")[0]}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="income-notes">Notes (optional)</Label>
        <Textarea
          id="income-notes"
          name="notes"
          placeholder="Any additional details..."
          className="min-h-12"
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? "Adding..." : "Add Income"}
        </Button>
      </div>
    </form>
  );
}

function TransferForm({
  accounts,
  onClose,
  onBack,
  onError,
}: {
  accounts: AccountWithBalance[];
  onClose: () => void;
  onBack: () => void;
  onError: (message: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  if (accounts.length < 2) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You need at least two accounts to make a transfer.
        </p>
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <form
      action={async (formData) => {
        setSubmitting(true);
        const result = await createTransferAction(formData);
        setSubmitting(false);
        if (result?.error) {
          onError(result.error);
          return;
        }
        onClose();
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label>From account</Label>
        <GroupedAccountSelect
          accounts={accounts}
          name="fromAccountId"
          placeholder="Select source account"
          showBalance
        />
      </div>
      <div className="space-y-2">
        <Label>To account</Label>
        <GroupedAccountSelect
          accounts={accounts}
          name="toAccountId"
          defaultValue={accounts.length > 1 ? accounts[1].id : undefined}
          placeholder="Select destination account"
          showBalance
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="transfer-amount">Amount</Label>
        <MoneyInput
          id="transfer-amount"
          name="amount"
          placeholder="0.00"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="transfer-description">Description (optional)</Label>
        <Input
          id="transfer-description"
          name="description"
          placeholder="e.g. Move to savings"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="transfer-date">Date</Label>
        <DatePicker
          id="transfer-date"
          name="date"
          required
          defaultValue={new Date().toISOString().split("T")[0]}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="transfer-notes">Notes (optional)</Label>
        <Textarea
          id="transfer-notes"
          name="notes"
          placeholder="Any additional details..."
          className="min-h-12"
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? "Transferring..." : "Transfer"}
        </Button>
      </div>
    </form>
  );
}

const TYPE_TITLES: Record<string, string> = {
  expense: "Add Expense",
  income: "Add Income",
  transfer: "Transfer Between Accounts",
};

export function TransactionList({
  transactions,
  accounts,
  expenseCategories,
  incomeCategories,
}: {
  transactions: TransactionRow[];
  accounts: AccountWithBalance[];
  expenseCategories: Category[];
  incomeCategories: Category[];
}) {
  const { showError, ErrorDialog } = useErrorDialog();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [open, setOpen] = useState(false);
  const [txnType, setTxnType] = useState<TransactionType>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<TransactionRow | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicatingTxn, setDuplicatingTxn] = useState<TransactionRow | null>(null);

  const allCategories = [...expenseCategories, ...incomeCategories];

  const handleClose = () => {
    setOpen(false);
    setTxnType(null);
  };

  const handleBack = () => {
    setTxnType(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={open}
          onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) setTxnType(null);
          }}
        >
          <DialogTrigger render={<Button />}>
            <PlusIcon className="size-4" data-icon="inline-start" />
            Add Transaction
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {txnType ? TYPE_TITLES[txnType] : "New Transaction"}
              </DialogTitle>
            </DialogHeader>
            {accounts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                You need to create an account first.
              </p>
            ) : txnType === null ? (
              <TypeSelectorMenu onSelect={setTxnType} />
            ) : txnType === "expense" ? (
              <ExpenseForm
                accounts={accounts}
                categories={expenseCategories}
                onClose={handleClose}
                onBack={handleBack}
                onError={showError}
              />
            ) : txnType === "income" ? (
              <IncomeForm
                accounts={accounts}
                categories={incomeCategories}
                onClose={handleClose}
                onBack={handleBack}
                onError={showError}
              />
            ) : (
              <TransferForm
                accounts={accounts}
                onClose={handleClose}
                onBack={handleBack}
                onError={showError}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      <TransactionTable
        transactions={transactions}
        onDelete={async (txn) => {
          if (!(await confirm("Delete this transaction? This cannot be undone."))) return;
          const result = await deleteTransactionAction(txn.id);
          if (result?.error) showError(result.error);
        }}
        onEdit={(txn) => {
          setEditingTxn(txn);
          setEditOpen(true);
        }}
        onDuplicate={(txn) => {
          setDuplicatingTxn(txn);
          setDuplicateOpen(true);
        }}
      />

      {/* Edit Transaction Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          {editingTxn && (
            <form
              action={async (formData) => {
                const result = await updateTransactionAction(formData);
                if (result?.error) {
                  showError(result.error);
                  return;
                }
                setEditOpen(false);
                setEditingTxn(null);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="transactionId" value={editingTxn.id} />
              <input type="hidden" name="txnType" value={editingTxn.type} />
              <div className="space-y-2">
                <Label htmlFor="edit-txn-description">Description</Label>
                <Input
                  id="edit-txn-description"
                  name="description"
                  defaultValue={editingTxn.description ?? ""}
                />
              </div>
              {editingTxn.categoryAccountId && (
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    name="categoryAccountId"
                    defaultValue={editingTxn.categoryAccountId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category">
                        {(value: string) => {
                          const cat = allCategories.find((c) => c.id === value);
                          return cat?.name ?? value;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(editingTxn.type === "expense" ? expenseCategories : incomeCategories).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-txn-notes">Notes</Label>
                <Textarea
                  id="edit-txn-notes"
                  name="notes"
                  defaultValue={editingTxn.notes ?? ""}
                  className="min-h-12"
                />
              </div>
              <Button type="submit" className="w-full">
                Save Changes
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate Transaction Dialog */}
      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Transaction</DialogTitle>
          </DialogHeader>
          {duplicatingTxn && accounts.length > 0 && (
            <form
              action={async (formData) => {
                formData.set("direction", duplicatingTxn.type);
                const result = await createTransactionAction(formData);
                if (result?.error) {
                  showError(result.error);
                  return;
                }
                setDuplicateOpen(false);
                setDuplicatingTxn(null);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Account</Label>
                <GroupedAccountSelect
                  accounts={accounts}
                  name="accountId"
                  defaultValue={duplicatingTxn.accountId}
                  placeholder="Select account"
                  showBalance
                />
              </div>
              {duplicatingTxn.categoryAccountId && (
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    name="categoryAccountId"
                    required
                    defaultValue={duplicatingTxn.categoryAccountId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category">
                        {(value: string) => {
                          const cat = allCategories.find((c) => c.id === value);
                          return cat?.name ?? value;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(duplicatingTxn.type === "expense" ? expenseCategories : incomeCategories).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="dup-amount">Amount</Label>
                <MoneyInput
                  id="dup-amount"
                  name="amount"
                  defaultValue={Math.abs(duplicatingTxn.amount).toFixed(2)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dup-description">Description (optional)</Label>
                <Input
                  id="dup-description"
                  name="description"
                  defaultValue={duplicatingTxn.description ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dup-date">Date</Label>
                <DatePicker
                  id="dup-date"
                  name="date"
                  required
                  defaultValue={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dup-notes">Notes</Label>
                <Textarea
                  id="dup-notes"
                  name="notes"
                  defaultValue={duplicatingTxn.notes ?? ""}
                  className="min-h-12"
                />
              </div>
              <Button type="submit" className="w-full">
                Create Duplicate
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
      <ErrorDialog />
    </div>
  );
}
