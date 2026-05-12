// Кратко: переиспользуемое модальное окно для форм и деталей сущностей.
import { useI18n } from "../hooks/useI18n.js";

// Служебная функция Modal: инкапсулирует отдельный шаг логики этого модуля.
export function Modal({ open, title, onClose, children }) {
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
