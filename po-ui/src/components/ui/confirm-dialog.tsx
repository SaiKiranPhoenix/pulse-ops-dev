import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel,
  description,
  isOpen,
  onCancel,
  onConfirm,
  title,
}: {
  readonly cancelLabel?: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly isOpen: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly title: string;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-labelledby="confirm-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-3 sm:p-4"
      role="dialog"
    >
      <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-md overflow-y-auto rounded-md border border-slate-200 bg-white p-4 shadow-xl sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-amber-50 text-amber-700 sm:h-9 sm:w-9">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-950" id="confirm-dialog-title">
              {title}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{description}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button className="w-full sm:w-auto" onClick={onCancel} type="button" variant="outline">
            {cancelLabel}
          </Button>
          <Button className="w-full sm:w-auto" onClick={onConfirm} type="button">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
