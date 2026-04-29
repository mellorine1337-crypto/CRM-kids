import { CheckCircle2, CreditCard, Download, Plus } from "lucide-react";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import { Modal } from "../components/Modal.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { StatCard } from "../components/StatCard.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { StripePaymentForm } from "../components/StripePaymentForm.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import {
  formatCurrency,
  formatDateTime,
  formatPaymentMethod,
} from "../utils/format.js";

const emptyManualForm = {
  childId: "",
  enrollmentId: "",
  amount: "",
  method: "CASH",
  status: "SUCCEEDED",
  paymentDate: new Date().toISOString().slice(0, 10),
  comment: "",
};

export function PaymentsPage() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [children, setChildren] = useState([]);
  const [checkout, setCheckout] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [reportRange, setReportRange] = useState("thisMonth");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const paymentsEndpoint = user.role === "PARENT" ? "/payments/my" : "/payments";

  const loadData = useCallback(async () => {
    try {
      const requests = [api.get(paymentsEndpoint), api.get(user.role === "PARENT" ? "/enrollments/my" : "/enrollments")];

      if (user.role === "STAFF") {
        requests.push(api.get("/children"));
      }

      const [paymentsResponse, enrollmentsResponse, childrenResponse] = await Promise.all(requests);
      setPayments(paymentsResponse.data.items);
      setEnrollments(enrollmentsResponse.data.items);
      setChildren(childrenResponse?.data?.items || []);
    } catch (error) {
      showToast({
        title: t("payments.loadFailed"),
        description: error.message,
        tone: "error",
      });
    }
  }, [paymentsEndpoint, showToast, t, user.role]);

  useEffect(() => {
    const bootstrap = async () => {
      await loadData();
    };

    bootstrap();
  }, [loadData]);

  useEffect(() => {
    if (user.role !== "STAFF" || searchParams.get("mode") !== "accept") {
      return;
    }

    const childId = searchParams.get("childId") || "";
    startTransition(() => {
      setManualOpen(true);
      setManualForm({
        ...emptyManualForm,
        childId,
      });
    });
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("mode");
      next.delete("childId");
      return next;
    });
  }, [searchParams, setSearchParams, user.role]);

  const unpaidEnrollments = useMemo(
    () =>
      enrollments.filter((enrollment) => Number(enrollment.financials?.debt || 0) > 0),
    [enrollments],
  );

  const manualChildren = useMemo(
    () => children.filter((child) => Number(child.financials?.debt || 0) > 0),
    [children],
  );

  const manualEnrollmentOptions = useMemo(
    () =>
      unpaidEnrollments.filter((enrollment) =>
        manualForm.childId ? enrollment.childId === manualForm.childId : true,
      ),
    [manualForm.childId, unpaidEnrollments],
  );

  const selectedEnrollment = manualEnrollmentOptions.find(
    (enrollment) => enrollment.id === manualForm.enrollmentId,
  );

  useEffect(() => {
    if (user.role !== "STAFF") {
      return;
    }

    if (!manualForm.childId && manualChildren[0]) {
      startTransition(() => {
        setManualForm((current) => ({
          ...current,
          childId: current.childId || manualChildren[0].id,
        }));
      });
      return;
    }

    if (
      manualForm.childId &&
      !manualEnrollmentOptions.some((enrollment) => enrollment.id === manualForm.enrollmentId)
    ) {
      const firstEnrollment = manualEnrollmentOptions[0];
      startTransition(() => {
        setManualForm((current) => ({
          ...current,
          enrollmentId: firstEnrollment?.id || "",
          amount: firstEnrollment
            ? String(Math.round(Number(firstEnrollment.financials?.debt || 0)))
            : "",
        }));
      });
    }
  }, [manualChildren, manualEnrollmentOptions, manualForm.childId, manualForm.enrollmentId, user.role]);

  const displayedPayments = pendingOnly
    ? payments.filter((payment) => payment.status === "PENDING")
    : payments;
  const parentTotalDebt = useMemo(
    () =>
      unpaidEnrollments.reduce(
        (sum, enrollment) => sum + Number(enrollment.financials?.debt || 0),
        0,
      ),
    [unpaidEnrollments],
  );
  const parentTotalPaid = useMemo(
    () =>
      payments.reduce((sum, payment) => {
        if (!["SUCCEEDED", "PARTIAL"].includes(payment.status)) {
          return sum;
        }

        return sum + Number(payment.amount || 0);
      }, 0),
    [payments],
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

  const handleManualChange = (event) => {
    const { name, value } = event.target;
    setManualForm((current) => ({ ...current, [name]: value }));
  };

  const handleManualSubmit = async (event) => {
    event.preventDefault();

    try {
      await api.post("/payments/manual", {
        enrollmentId: manualForm.enrollmentId,
        amount: Number(manualForm.amount),
        method: manualForm.method,
        status: manualForm.status,
        paymentDate: manualForm.paymentDate
          ? new Date(manualForm.paymentDate).toISOString()
          : undefined,
        comment: manualForm.comment || undefined,
        serviceLabel: selectedEnrollment?.lesson?.title,
      });

      setManualOpen(false);
      setManualForm(emptyManualForm);
      await loadData();
      showToast({
        title: t("payments.createManualSuccess"),
        description: t("payments.createManualDescription"),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("payments.createFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  const handleExport = async () => {
    try {
      const params = reportFrom || reportTo
        ? {
            from: reportFrom || undefined,
            to: reportTo || undefined,
          }
        : {
            range: reportRange,
          };

      const response = await api.get("/payments/export", {
        params,
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "payments-report.xlsx";
      document.body.append(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showToast({
        title: t("payments.exportFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  if (user.role === "PARENT") {
    return (
      <div className="stack-xl">
        <PageHeader
          title={t("payments.title")}
          description={t("payments.parentDescription")}
        />

        <section className="grid-cards">
          <StatCard
            icon={CreditCard}
            label={t("payments.parentPaid")}
            value={formatCurrency(parentTotalPaid, "kzt", locale)}
            tone="mint"
          />
          <StatCard
            icon={CreditCard}
            label={t("payments.parentDebt")}
            value={formatCurrency(parentTotalDebt, "kzt", locale)}
            tone={parentTotalDebt > 0 ? "danger" : "blue"}
          />
          <StatCard
            icon={CheckCircle2}
            label={t("payments.parentServicesWithDebt")}
            value={unpaidEnrollments.length}
            tone="blue"
          />
        </section>

        <section className="panel panel--side">
          <div className="staff-dashboard__section-head">
            <div>
              <h2>{t("payments.parentDebtTitle")}</h2>
              <p>{t("payments.parentDebtDescription")}</p>
            </div>
            <CreditCard size={18} />
          </div>

          {unpaidEnrollments.length ? (
            <div className="stack-md">
              {unpaidEnrollments.map((enrollment) => (
                <article className="parent-payment-card" key={enrollment.id}>
                  <div className="parent-payment-card__copy">
                    <strong>{enrollment.lesson?.title}</strong>
                    <span>{enrollment.child?.fullName}</span>
                    <span>
                      {formatCurrency(enrollment.financials?.debt || 0, "kzt", locale)}
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
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">{t("payments.noDebt")}</div>
          )}
        </section>

        <section className="panel panel--side">
          <div className="staff-dashboard__section-head">
            <div>
              <h2>{t("payments.parentHistoryTitle")}</h2>
              <p>{t("payments.parentHistoryDescription")}</p>
            </div>
          </div>

          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("payments.date")}</th>
                  <th>{t("payments.child")}</th>
                  <th>{t("payments.service")}</th>
                  <th>{t("payments.amount")}</th>
                  <th>{t("payments.status")}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDateTime(payment.paidAt || payment.createdAt, locale)}</td>
                    <td>{payment.enrollment?.child?.fullName}</td>
                    <td>{payment.serviceLabel || payment.enrollment?.lesson?.title}</td>
                    <td>{formatCurrency(payment.amount, payment.currency, locale)}</td>
                    <td>
                      <StatusBadge status={payment.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!payments.length ? (
              <div className="empty-state">{t("payments.noItems")}</div>
            ) : null}
          </div>
        </section>

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

  return (
    <div className="stack-xl">
      <PageHeader
        title={t("payments.title")}
        description={t("payments.description")}
        action={
          user.role === "STAFF" ? (
            <button
              type="button"
              className="button button--primary"
              onClick={() => setManualOpen(true)}
            >
              <Plus size={16} />
              {t("payments.manualTitle")}
            </button>
          ) : null
        }
      />

      {user.role === "STAFF" ? (
        <section className="two-column">
          <article className="panel stack-md">
            <div className="panel__header">
              <div>
                <h2>{t("payments.manualTitle")}</h2>
                <p>{t("payments.manualDescription")}</p>
              </div>
              <CreditCard size={18} />
            </div>

            <div className="stack-sm">
              {unpaidEnrollments.slice(0, 4).map((enrollment) => (
                <div className="list-row" key={enrollment.id}>
                  <div>
                    <strong>{enrollment.child?.fullName}</strong>
                    <span>
                      {enrollment.lesson?.title} •{" "}
                      {formatCurrency(enrollment.financials?.debt || 0, "kzt", locale)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => {
                      setManualOpen(true);
                      setManualForm((current) => ({
                        ...current,
                        childId: enrollment.childId,
                        enrollmentId: enrollment.id,
                        amount: String(Math.round(Number(enrollment.financials?.debt || 0))),
                      }));
                    }}
                  >
                    {t("payments.openAccept")}
                  </button>
                </div>
              ))}
              {!unpaidEnrollments.length ? (
                <div className="empty-state">{t("payments.noDebt")}</div>
              ) : null}
            </div>
          </article>

          <article className="panel stack-md">
            <div className="panel__header">
              <div>
                <h2>{t("payments.exportTitle")}</h2>
                <p>{t("payments.exportDescription")}</p>
              </div>
              <Download size={18} />
            </div>

            <div className="row-actions">
              {["today", "week", "thisMonth", "lastMonth"].map((rangeKey) => (
                <button
                  key={rangeKey}
                  type="button"
                  className={
                    reportRange === rangeKey
                      ? "button button--primary"
                      : "button button--secondary"
                  }
                  onClick={() => {
                    setReportRange(rangeKey);
                    setReportFrom("");
                    setReportTo("");
                  }}
                >
                  {t(`payments.range${rangeKey.charAt(0).toUpperCase()}${rangeKey.slice(1)}`)}
                </button>
              ))}
            </div>

            <div className="form-grid">
              <label className="field">
                <span>{t("payments.fromDate")}</span>
                <input
                  type="date"
                  value={reportFrom}
                  onChange={(event) => setReportFrom(event.target.value)}
                />
              </label>
              <label className="field">
                <span>{t("payments.toDate")}</span>
                <input
                  type="date"
                  value={reportTo}
                  onChange={(event) => setReportTo(event.target.value)}
                />
              </label>
            </div>

            <button
              type="button"
              className="button button--primary"
              onClick={handleExport}
            >
              <Download size={16} />
              {t("payments.exportButton")}
            </button>
          </article>
        </section>
      ) : null}

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
                  {formatCurrency(enrollment.financials?.debt || enrollment.lesson?.price, "KZT", locale)}
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

      {user.role === "STAFF" ? (
        <section className="row-actions">
          <button
            type="button"
            className={pendingOnly ? "button button--primary" : "button button--secondary"}
            onClick={() => setPendingOnly((current) => !current)}
          >
            {t("payments.pendingOnly")}
          </button>
        </section>
      ) : null}

      <section className="panel stack-md">
        <div className="panel__header">
          <div>
            <h2>{t("payments.historyTitle")}</h2>
            <p>{t("payments.historyDescription")}</p>
          </div>
        </div>

        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("payments.date")}</th>
                <th>{t("payments.child")}</th>
                <th>{t("payments.service")}</th>
                <th>{t("payments.amount")}</th>
                <th>{t("payments.method")}</th>
                <th>{t("payments.status")}</th>
                <th>{t("payments.staff")}</th>
                <th>{t("payments.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {displayedPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>{formatDateTime(payment.paidAt || payment.createdAt, locale)}</td>
                  <td>{payment.enrollment?.child?.fullName}</td>
                  <td>
                    <strong>{payment.serviceLabel || payment.enrollment?.lesson?.title}</strong>
                    {payment.comment ? <div>{payment.comment}</div> : null}
                  </td>
                  <td>{formatCurrency(payment.amount, payment.currency, locale)}</td>
                  <td>{formatPaymentMethod(payment.method, locale)}</td>
                  <td>
                    <StatusBadge status={payment.status} />
                  </td>
                  <td>{payment.recordedBy?.fullName || "Система"}</td>
                  <td>
                    <div className="row-actions">
                      {payment.status === "PENDING" ? (
                        <button
                          type="button"
                          className="button button--secondary"
                          onClick={() => handleConfirmPayment(payment.id)}
                        >
                          <CheckCircle2 size={16} />
                          {t("payments.confirmAction")}
                        </button>
                      ) : null}
                      {user.role === "STAFF" && Number(payment.enrollment?.financials?.debt || 0) > 0 ? (
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => {
                            setManualOpen(true);
                            setManualForm((current) => ({
                              ...current,
                              childId: payment.enrollment?.child?.id || "",
                              enrollmentId: payment.enrollment?.id || "",
                              amount: String(
                                Math.round(Number(payment.enrollment?.financials?.debt || 0)),
                              ),
                            }));
                          }}
                        >
                          {t("payments.payNow")}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!displayedPayments.length ? (
            <div className="empty-state">
              {pendingOnly ? t("payments.noPending") : t("payments.noItems")}
            </div>
          ) : null}
        </div>
      </section>

      <Modal
        open={manualOpen}
        title={t("payments.manualTitle")}
        onClose={() => setManualOpen(false)}
      >
        <form className="stack-lg" onSubmit={handleManualSubmit}>
          <label className="field">
            <span>{t("payments.child")}</span>
            <select
              name="childId"
              value={manualForm.childId}
              onChange={handleManualChange}
              required
            >
              <option value="">{t("payments.selectChild")}</option>
              {manualChildren.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.fullName}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>{t("payments.service")}</span>
            <select
              name="enrollmentId"
              value={manualForm.enrollmentId}
              onChange={handleManualChange}
              required
            >
              <option value="">{t("payments.selectEnrollment")}</option>
              {manualEnrollmentOptions.map((enrollment) => (
                <option key={enrollment.id} value={enrollment.id}>
                  {enrollment.lesson?.title} • {enrollment.child?.fullName}
                </option>
              ))}
            </select>
          </label>

          <div className="form-grid">
            <label className="field">
              <span>{t("payments.amount")}</span>
              <input
                type="number"
                name="amount"
                min="1"
                value={manualForm.amount}
                onChange={handleManualChange}
                placeholder={t("payments.amountPlaceholder")}
                required
              />
            </label>

            <label className="field">
              <span>{t("payments.method")}</span>
              <select
                name="method"
                value={manualForm.method}
                onChange={handleManualChange}
              >
                {["CASH", "BANK_TRANSFER", "TERMINAL", "QR"].map((method) => (
                  <option key={method} value={method}>
                    {formatPaymentMethod(method, locale)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{t("payments.status")}</span>
              <select
                name="status"
                value={manualForm.status}
                onChange={handleManualChange}
              >
                {["SUCCEEDED", "PARTIAL", "PENDING"].map((status) => (
                  <option key={status} value={status}>
                    {t(`statuses.${status}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{t("payments.paymentDate")}</span>
              <input
                type="date"
                name="paymentDate"
                value={manualForm.paymentDate}
                onChange={handleManualChange}
              />
            </label>
          </div>

          <label className="field">
            <span>{t("payments.comment")}</span>
            <textarea
              rows="4"
              name="comment"
              value={manualForm.comment}
              onChange={handleManualChange}
            />
          </label>

          {selectedEnrollment ? (
            <div className="detail-card">
              <span>{t("payments.balance")}</span>
              <strong>
                {formatCurrency(selectedEnrollment.financials?.debt || 0, "kzt", locale)}
              </strong>
            </div>
          ) : null}

          <div className="row-actions">
            <button type="submit" className="button button--primary">
              <CreditCard size={16} />
              {t("payments.createManual")}
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setManualOpen(false)}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </Modal>

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
