"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { PencilIcon, TrashIcon, CopyIcon } from "lucide-react";
import { formatDate } from "@/lib/utils/format-date";
import type { TransactionRow } from "@/lib/services/transactions";

export interface TransactionTableProps {
  transactions: TransactionRow[];
  /** Called when a row's inline or context-menu delete is triggered. */
  onDelete?: (txn: TransactionRow) => void;
  /** Called when "Edit Transaction" is chosen from the context menu. */
  onEdit?: (txn: TransactionRow) => void;
  /** Called when "Duplicate Transaction" is chosen from the context menu. */
  onDuplicate?: (txn: TransactionRow) => void;
  /** Message shown when there are no transactions. */
  emptyMessage?: string;
}

function RowCells({
  txn,
  onDelete,
}: {
  txn: TransactionRow;
  onDelete?: (txn: TransactionRow) => void;
}) {
  return (
    <>
      <TableCell className="whitespace-nowrap">
        {formatDate(txn.date)}
      </TableCell>
      <TableCell>
        {txn.description || (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell>
        {txn.type === "transfer" ? (
          <Badge variant="outline">Transfer</Badge>
        ) : txn.categoryName ? (
          <Badge variant="secondary">{txn.categoryName}</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {txn.type === "transfer"
          ? `${txn.accountName} → ${txn.transferAccountName}`
          : txn.accountName}
      </TableCell>
      <TableCell
        className={`text-right font-medium ${
          txn.type === "expense"
            ? "text-negative"
            : txn.type === "income"
              ? "text-positive"
              : ""
        }`}
      >
        {txn.signedAmountFormatted}
      </TableCell>
      {onDelete && (
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => onDelete(txn)}
          >
            Delete
          </Button>
        </TableCell>
      )}
    </>
  );
}

export function TransactionTable({
  transactions,
  onDelete,
  onEdit,
  onDuplicate,
  emptyMessage = "No transactions for this period.",
}: TransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <p className="text-center py-8 text-muted-foreground">{emptyMessage}</p>
    );
  }

  const hasContextMenu = !!(onDelete || onEdit || onDuplicate);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            {onDelete && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((txn, i) =>
            hasContextMenu ? (
              <ContextMenu key={txn.id}>
                <ContextMenuTrigger
                  render={<TableRow />}
                  className="animate-fade-up"
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  <RowCells txn={txn} onDelete={onDelete} />
                </ContextMenuTrigger>
                <ContextMenuContent>
                  {onEdit && (
                    <ContextMenuItem onClick={() => onEdit(txn)}>
                      <PencilIcon />
                      Edit Transaction
                    </ContextMenuItem>
                  )}
                  {onDuplicate && (
                    <ContextMenuItem onClick={() => onDuplicate(txn)}>
                      <CopyIcon />
                      Duplicate Transaction
                    </ContextMenuItem>
                  )}
                  {(onEdit || onDuplicate) && onDelete && (
                    <ContextMenuSeparator />
                  )}
                  {onDelete && (
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => onDelete(txn)}
                    >
                      <TrashIcon />
                      Delete Transaction
                    </ContextMenuItem>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            ) : (
              <TableRow
                key={txn.id}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 20}ms` }}
              >
                <RowCells txn={txn} />
              </TableRow>
            )
          )}
        </TableBody>
      </Table>
    </div>
  );
}
