// Кратко: управляет всплывающими уведомлениями frontend-части.
import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { ToastContext } from "./toast-context.js";

const toneIcons = {
  success: CheckCircle2,
  error: CircleAlert,
  info: Info,
};

// Провайдер ToastProvider: передаёт общее состояние и методы через context.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, description, tone = "info" }) => {
      const id = crypto.randomUUID();
      const nextToast = { id, title, description, tone };

      setToasts((current) => [nextToast, ...current].slice(0, 4));
      window.setTimeout(() => dismissToast(id), 4000);
    },
    [dismissToast],
  );

  const value = useMemo(
    () => ({
      showToast,
      dismissToast,
    }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport">
        {toasts.map((toast) => {
          const Icon = toneIcons[toast.tone] || Info;
          return (
            <article
              key={toast.id}
              className={`toast toast--${toast.tone}`}
              role="status"
            >
              <Icon size={18} />
              <div className="toast__content">
                <strong>{toast.title}</strong>
                {toast.description ? <span>{toast.description}</span> : null}
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => dismissToast(toast.id)}
              >
                <X size={16} />
              </button>
            </article>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
