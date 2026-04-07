import { CreditCard } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { Modal } from "../components/Modal.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { StripePaymentForm } from "../components/StripePaymentForm.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import { formatCurrency, formatDate } from "../utils/format.js";

export function PaymentsPage() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const [payments, setPayments] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [checkout, setCheckout] = useState(null);
  const paymentsEndpoint = user.role === "PARENT" ? "/payments/my" : "/payments";

  const loadData = async () => {
    try {
      const requests = [api.get(paymentsEndpoint)];

      if (user.role === "PARENT") {
        requests.push(api.get("/enrollments/my"));
      }

      const [paymentsResponse, enrollmentsResponse] = await Promise.all(requests);
      setPayments(paymentsResponse.data.items);
      setEnrollments(enrollmentsResponse?.data?.items || []);
    } catch (error) {
      showToast({
        title: t("payments.loadFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const requests = [api.get(paymentsEndpoint)];

        if (user.role === "PARENT") {
          requests.push(api.get("/enrollments/my"));
        }

        const [paymentsResponse, enrollmentsResponse] = await Promise.all(requests);
        setPayments(paymentsResponse.data.items);
        setEnrollments(enrollmentsResponse?.data?.items || []);
      } catch (error) {
        showToast({
          title: t("payments.loadFailed"),
          description: error.message,
          tone: "error",
        });
      }
    };

    bootstrap();
  }, [paymentsEndpoint, showToast, t, user.role]);

  const unpaidEnrollments = useMemo(
    () =>
      enrollments.filter(
        (enrollment) =>
          enrollment.status !== "CANCELLED" &&
          !enrollment.payments?.some((payment) => payment.status === "SUCCEEDED"),
      ),
    [enrollments],
  );

  const handleCreatePayment = async (enrollmentId) => {
    try {
      const { data } = await api.post("/payments/create-intent", {
        enrollmentId,
      });

      if (data.mode === "mock") {
        await api.post(`/payments/${data.payment.id}/confirm`);
        await loadData();
        showToast({
          title: t("payments.mockCompleted"),
          description: t("payments.mockCompletedDescription"),
          tone: "success",
        });
        return;
      }

      setCheckout({
        paymentId: data.payment.id,
        clientSecret: data.clientSecret,
        publishableKey:
          data.publishableKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
      });
    } catch (error) {
      showToast({
        title: t("payments.createFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  const handleConfirmPayment = async (paymentId) => {
    try {
      await api.post(`/payments/${paymentId}/confirm`);
      setCheckout(null);
      await loadData();
      showToast({
        title: t("payments.confirmed"),
        description: t("payments.confirmedDescription"),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("payments.confirmFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  return (
    <div className="stack-xl">
      <PageHeader
        title={t("payments.title")}
        description={t("payments.description")}
      />

      {user.role === "PARENT" && unpaidEnrollments.length ? (
        <section className="panel stack-md">
          <div className="panel__header">
            <div>
              <h2>{t("payments.unpaidTitle")}</h2>
              <p>{t("payments.unpaidDescription")}</p>
            </div>
          </div>
          {unpaidEnrollments.map((enrollment) => (
            <div className="list-row" key={enrollment.id}>
              <div>
                <strong>{enrollment.lesson?.title}</strong>
                <span>
                  {enrollment.child?.fullName} •{" "}
                  {formatCurrency(enrollment.lesson?.price, "KZT", locale)}
                </span>
              </div>
              <button
                type="button"
                className="button button--primary"
                onClick={() => handleCreatePayment(enrollment.id)}
              >
                <CreditCard size={16} />
                {t("payments.payNow")}
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <div className="table-shell">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("payments.lesson")}</th>
              <th>{t("payments.child")}</th>
              <th>{t("payments.amount")}</th>
              <th>{t("payments.status")}</th>
              <th>{t("payments.date")}</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.enrollment?.lesson?.title}</td>
                <td>{payment.enrollment?.child?.fullName}</td>
                <td>{formatCurrency(payment.amount, payment.currency, locale)}</td>
                <td>
                  <StatusBadge status={payment.status} />
                </td>
                <td>{formatDate(payment.createdAt, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!payments.length ? (
          <div className="empty-state">{t("payments.noItems")}</div>
        ) : null}
      </div>

      <Modal
        open={Boolean(checkout)}
        title={t("payments.stripeModalTitle")}
        onClose={() => setCheckout(null)}
      >
        {checkout ? (
          <StripePaymentForm
            paymentId={checkout.paymentId}
            clientSecret={checkout.clientSecret}
            publishableKey={checkout.publishableKey}
            onConfirm={handleConfirmPayment}
            onError={(message) =>
              showToast({
                title: t("payments.stripeError"),
                description: message,
                tone: "error",
              })
            }
          />
        ) : null}
      </Modal>
    </div>
  );
}
