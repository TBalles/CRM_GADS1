"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, AlertCircle, CheckCircle2, AlertTriangle, Info } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES: Record<ToastType, string> = {
  success:
    "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-200",
  error:
    "bg-red-50 border-red-200 text-red-800 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200",
  warning:
    "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200",
  info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-200",
};

const ICON_COLORS: Record<ToastType, string> = {
  success: "text-emerald-500",
  error: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
};

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const Icon = ICONS[toast.type];
  React.useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), toast.duration);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      role="status"
      className={`flex max-w-md items-start gap-3 rounded-lg border px-4 py-3 shadow-lg animate-in slide-in-from-top-2 fade-in duration-200 ${STYLES[toast.type]}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ICON_COLORS[toast.type]}`} />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        aria-label="Cerrar notificación"
        className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [mounted, setMounted] = React.useState(false);

  // The portal target only exists in the browser.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const showToast = React.useCallback(
    (message: string, type: ToastType = "info", duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, type, duration }]);
    },
    [],
  );

  const removeToast = React.useCallback(
    (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  const value = React.useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        toasts.length > 0 &&
        createPortal(
          <div className="fixed right-4 top-4 z-[130] flex flex-col gap-2">
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onRemove={removeToast} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
};
