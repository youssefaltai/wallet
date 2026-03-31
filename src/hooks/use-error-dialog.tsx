"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ErrorDialogProps {
  open: boolean;
  message: string | null;
  onClose: () => void;
}

function ErrorDialog({ open, message, onClose }: ErrorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Error</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{message}</p>
        <DialogFooter>
          <DialogClose render={<Button />}>OK</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useErrorDialog() {
  const [error, setError] = useState<string | null>(null);

  const showError = useCallback((message: string) => {
    setError(message);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const ErrorDialogComponent = useCallback(() => (
    <ErrorDialog open={error !== null} message={error} onClose={clearError} />
  ), [error, clearError]);

  return { showError, ErrorDialog: ErrorDialogComponent } as const;
}
