import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToastVariant = "error" | "info" | "success";

type Toast = {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly variant: ToastVariant;
};

type ToastInput = Omit<Toast, "id">;

type ToastContextValue = {
  readonly notify: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, []);

  const notify = useCallback(
    (toast: ToastInput) => {
      const id = crypto.randomUUID();
      setToasts((currentToasts) => [...currentToasts.slice(-3), { ...toast, id }]);
      window.setTimeout(() => {
        dismiss(id);
      }, 4500);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 grid w-[calc(100vw-2rem)] max-w-sm gap-2"
      >
        {toasts.map((toast) => {
          const Icon =
            toast.variant === "success" ? CheckCircle2 : toast.variant === "error" ? XCircle : Info;

          return (
            <div
              className={cn(
                "rounded-md border bg-white p-3 text-sm shadow-lg",
                toast.variant === "success" && "border-emerald-200",
                toast.variant === "error" && "border-red-200",
                toast.variant === "info" && "border-slate-200",
              )}
              key={toast.id}
              role="status"
            >
              <div className="flex items-start gap-3">
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    toast.variant === "success" && "text-emerald-700",
                    toast.variant === "error" && "text-red-700",
                    toast.variant === "info" && "text-cyan-700",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-950">{toast.title}</p>
                  {toast.description === undefined ? null : (
                    <p className="mt-1 text-slate-600">{toast.description}</p>
                  )}
                </div>
                <Button
                  aria-label="Dismiss notification"
                  className="h-7 w-7 shrink-0 p-0"
                  onClick={() => {
                    dismiss(toast.id);
                  }}
                  type="button"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (context === null) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
}
