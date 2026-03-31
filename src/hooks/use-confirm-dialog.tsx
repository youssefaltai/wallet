"use client";

import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  message: string | undefined;
  onClose: (confirmed: boolean) => void;
}

function ConfirmDialog({ open, message, onClose }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { if (!o) onClose(false); }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{message}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => onClose(true)}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useConfirmDialog() {
  const [state, setState] = useState<{ message: string } | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ message });
    });
  }, []);

  const handleClose = useCallback((confirmed: boolean) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setState(null);
  }, []);

  const ConfirmDialogComponent = useCallback(() => (
    <ConfirmDialog
      open={state !== null}
      message={state?.message}
      onClose={handleClose}
    />
  ), [state, handleClose]);

  return { confirm, ConfirmDialog: ConfirmDialogComponent } as const;
}
