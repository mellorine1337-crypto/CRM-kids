import { useI18n } from "../hooks/useI18n.js";
import { formatStatus } from "../utils/format.js";

export function StatusBadge({ status, label }) {
  const { locale } = useI18n();

  return (
    <span className={`status-badge status-badge--${String(status).toLowerCase()}`}>
      {label || formatStatus(status, locale)}
    </span>
  );
}
