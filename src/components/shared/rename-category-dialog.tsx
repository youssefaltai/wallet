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
import { renameCategoryAction } from "@/app/(app)/actions";
import type { CategoryWithTotal } from "@/lib/services/categories";

export function RenameCategoryDialog({
  open,
  onOpenChange,
  category,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryWithTotal | null;
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { showError, ErrorDialog } = useErrorDialog();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
        </DialogHeader>
        {category && (
          <form
            action={async (formData) => {
              setSubmitting(true);
              formData.set("categoryId", category.id);
              const result = await renameCategoryAction(formData);
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
              <Label htmlFor="rename-name">Name</Label>
              <Input
                id="rename-name"
                name="name"
                defaultValue={category.name}
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </form>
        )}
      </DialogContent>
      <ErrorDialog />
    </Dialog>
  );
}
