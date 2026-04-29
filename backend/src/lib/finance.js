const countablePaymentStatuses = new Set(["SUCCEEDED", "PARTIAL"]);

const toNumber = (value) => Number(value || 0);

const getEnrollmentAccrued = (enrollment) =>
  enrollment?.status === "CANCELLED" ? 0 : toNumber(enrollment?.lesson?.price);

const getEnrollmentPaid = (enrollment) =>
  (enrollment?.payments || [])
    .filter((payment) => countablePaymentStatuses.has(payment.status))
    .reduce((sum, payment) => sum + toNumber(payment.amount), 0);

const getEnrollmentPending = (enrollment) =>
  (enrollment?.payments || [])
    .filter((payment) => payment.status === "PENDING")
    .reduce((sum, payment) => sum + toNumber(payment.amount), 0);

const buildEnrollmentFinancials = (enrollment) => {
  const accrued = getEnrollmentAccrued(enrollment);
  const paid = getEnrollmentPaid(enrollment);
  const pending = getEnrollmentPending(enrollment);
  const debt = Math.max(accrued - paid, 0);

  let balanceStatus = "PENDING";

  if (debt === 0 && accrued > 0) {
    balanceStatus = "SUCCEEDED";
  } else if (paid > 0) {
    balanceStatus = "PARTIAL";
  } else if (pending > 0) {
    balanceStatus = "PENDING";
  }

  return {
    accrued,
    paid,
    pending,
    debt,
    balanceStatus,
  };
};

const buildChildFinancials = (child) => {
  const totals = (child?.enrollments || []).reduce(
    (summary, enrollment) => {
      const financials = buildEnrollmentFinancials(enrollment);
      summary.accrued += financials.accrued;
      summary.paid += financials.paid;
      summary.pending += financials.pending;
      summary.debt += financials.debt;
      return summary;
    },
    {
      accrued: 0,
      paid: 0,
      pending: 0,
      debt: 0,
    },
  );

  let balanceStatus = "PENDING";

  if (totals.debt === 0 && totals.accrued > 0) {
    balanceStatus = "SUCCEEDED";
  } else if (totals.paid > 0) {
    balanceStatus = "PARTIAL";
  }

  return {
    ...totals,
    balanceStatus,
  };
};

module.exports = {
  buildChildFinancials,
  buildEnrollmentFinancials,
  countablePaymentStatuses,
  getEnrollmentAccrued,
  getEnrollmentPaid,
};
