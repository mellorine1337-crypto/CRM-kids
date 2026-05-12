// Кратко: визуально показывает статус записи, оплаты, посещения и других сущностей.
import { useI18n } from "../hooks/useI18n.js";
import { formatStatus } from "../utils/format.js";

// Служебная функция StatusBadge: инкапсулирует отдельный шаг логики этого модуля.
export function StatusBadge({ status, label }) {
  const { locale } = useI18n();

  return (
    <span className={`status-badge status-badge--${String(status).toLowerCase()}`}>
      {label || formatStatus(status, locale)}
    </span>
  );
}
