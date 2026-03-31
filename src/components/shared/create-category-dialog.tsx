"use client";

import { useState } from "react";
import { useErrorDialog } from "@/hooks/use-error-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCategoryAction } from "@/app/(app)/actions";
import { CurrencySelect } from "@/components/shared/currency-select";

export function CreateCategoryDialog({
  open,
  onOpenChange,
  type,
  onSuccess,
  createLabel,
  placeholder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "expense" | "income";
  onSuccess: () => void;
  createLabel: string;
  placeholder: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { showError, ErrorDialog } = useErrorDialog();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{createLabel}</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            setSubmitting(true);
            formData.set("type", type);
            const result = await createCategoryAction(formData);
            setSubmitting(false);
            if (result?.error) {
              showError(result.error);
              return;
            }
            onOpenChange(false);
            onSuccess();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor={`new-${type}-name`}>Name</Label>
            <Input
              id={`new-${type}-name`}
              name="name"
              placeholder={placeholder}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`new-${type}-currency`}>Currency</Label>
            <CurrencySelect id={`new-${type}-currency`} />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating..." : "Create"}
          </Button>
        </form>
      </DialogContent>
      <ErrorDialog />
    </Dialog>
  );
}
