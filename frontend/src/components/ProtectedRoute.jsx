import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";

export function ProtectedRoute({ children }) {
  const location = useLocation();
  const { initialized, user } = useAuth();
  const { t } = useI18n();

  if (!initialized) {
    return (
      <div className="screen-loader">
        <div className="spinner" />
        <span>{t("loading.workspace")}</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
