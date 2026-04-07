import { Ban } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import { formatDate, formatStatus } from "../utils/format.js";

export function EnrollmentsPage() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const [enrollments, setEnrollments] = useState([]);
  const endpoint = user.role === "PARENT" ? "/enrollments/my" : "/enrollments";

  const loadEnrollments = async () => {
    try {
      const { data } = await api.get(endpoint);
      setEnrollments(data.items);
    } catch (error) {
      showToast({
        title: t("enrollments.loadFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const { data } = await api.get(endpoint);
        setEnrollments(data.items);
      } catch (error) {
        showToast({
          title: t("enrollments.loadFailed"),
          description: error.message,
          tone: "error",
        });
      }
    };

    bootstrap();
  }, [endpoint, showToast, t]);

  const handleCancel = async (enrollment) => {
    try {
      await api.patch(`/enrollments/${enrollment.id}/cancel`);
      await loadEnrollments();
      showToast({
        title: t("enrollments.cancelled"),
        description: t("enrollments.cancelledDescription", {
          name: enrollment.child?.fullName,
        }),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("enrollments.cancelFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  return (
    <div className="stack-xl">
      <PageHeader
        title={t("enrollments.title")}
        description={t("enrollments.description")}
      />

      <div className="table-shell">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("enrollments.child")}</th>
              <th>{t("enrollments.lesson")}</th>
              <th>{t("enrollments.date")}</th>
              <th>{t("enrollments.status")}</th>
              <th>{t("enrollments.payment")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {enrollments.map((enrollment) => {
              const successfulPayment = enrollment.payments?.find(
                (payment) => payment.status === "SUCCEEDED",
              );
              const paymentLabel = successfulPayment
                ? formatStatus("SUCCEEDED", locale)
                : enrollment.payments?.[0]
                  ? formatStatus(enrollment.payments[0].status, locale)
                  : t("enrollments.unpaid");

              return (
                <tr key={enrollment.id}>
                  <td>{enrollment.child?.fullName}</td>
                  <td>{enrollment.lesson?.title}</td>
                  <td>{formatDate(enrollment.lesson?.date, locale)}</td>
                  <td>
                    <StatusBadge status={enrollment.status} />
                  </td>
                  <td>{paymentLabel}</td>
                  <td>
                    {user.role === "PARENT" && enrollment.status === "BOOKED" ? (
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => handleCancel(enrollment)}
                      >
                        <Ban size={16} />
                        {t("enrollments.cancel")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!enrollments.length ? (
          <div className="empty-state">{t("enrollments.noItems")}</div>
        ) : null}
      </div>
    </div>
  );
}
