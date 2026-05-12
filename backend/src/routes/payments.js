// Кратко: долги, оплаты, подтверждение платежей и финансовая история.
const express = require("express");
const { z } = require("zod");
const XLSX = require("xlsx");
const { prisma } = require("../lib/prisma");
const { createNotification } = require("../lib/notifications");
const { stripe } = require("../lib/stripe");
const { buildEnrollmentFinancials } = require("../lib/finance");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");
const { serializePayment } = require("../utils/serializers");
const { env } = require("../config/env");

const router = express.Router();

const createIntentSchema = z.object({
  enrollmentId: z.string(),
  currency: z.string().min(3).max(3).optional(),
});

const manualPaymentSchema = z.object({
  enrollmentId: z.string(),
  amount: z.coerce.number().positive(),
  status: z.enum(["SUCCEEDED", "PARTIAL", "PENDING"]),
  method: z.enum(["CASH", "BANK_TRANSFER", "TERMINAL", "QR"]),
  paymentDate: z.coerce.date().optional(),
  comment: z.string().max(1000).optional().nullable(),
  serviceLabel: z.string().min(2).max(160).optional().nullable(),
});

const exportQuerySchema = z
  .object({
    range: z.enum(["today", "week", "thisMonth", "lastMonth"]).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine(
    (value) => !(value.from && value.to) || value.from <= value.to,
    "The start date must be earlier than the end date",
  );

// REST-маршрут USE: обрабатывает запросы этого модуля.
router.use(requireAuth);

const paymentInclude = {
  recordedBy: true,
  history: {
    include: {
      createdBy: true,
    },
    orderBy: { createdAt: "desc" },
  },
  enrollment: {
    include: {
      child: {
        include: {
          parent: true,
        },
      },
      lesson: {
        include: {
          creator: true,
          enrollments: { select: { status: true } },
        },
      },
      payments: {
        include: {
          recordedBy: true,
          history: {
            include: {
              createdBy: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      attendance: true,
      journal: true,
    },
  },
};

const countableStatuses = new Set(["SUCCEEDED", "PARTIAL"]);

// Функция formatDateCell: форматирует данные для вывода в интерфейсе.
const formatDateCell = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

// Функция getDateRange: возвращает значение или подготовленные данные по входным параметрам.
const getDateRange = (query) => {
  const now = new Date();

  if (query.from || query.to) {
    const from = query.from ? new Date(query.from) : new Date("2000-01-01T00:00:00.000Z");
    const to = query.to ? new Date(query.to) : new Date("2100-01-01T00:00:00.000Z");
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  const start = new Date(now);
  const end = new Date(now);

  switch (query.range) {
    case "today":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { from: start, to: end };
    case "week": {
      const day = start.getDay();
      const offset = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - offset);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { from: start, to: end };
    }
    case "lastMonth": {
      start.setMonth(start.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      return { from: start, to: end };
    }
    case "thisMonth":
    default:
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { from: start, to: end };
  }
};

// Служебная функция addPaymentHistory: инкапсулирует отдельный шаг логики этого модуля.
const addPaymentHistory = ({ paymentId, fromStatus, toStatus, comment, createdById }) =>
  prisma.paymentHistory.create({
    data: {
      paymentId,
      fromStatus: fromStatus || null,
      toStatus,
      comment: comment || null,
      createdById: createdById || null,
    },
  });

// Функция loadEnrollment: загружает данные и обновляет состояние.
const loadEnrollment = async (enrollmentId) => {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: paymentInclude.enrollment.include,
  });

  if (!enrollment) {
    throw { status: 404, message: "Enrollment not found" };
  }

  return enrollment;
};

// Функция getOutstandingForEnrollment: возвращает значение или подготовленные данные по входным параметрам.
const getOutstandingForEnrollment = (enrollment, ignoredPaymentId) => {
  const scopedEnrollment = ignoredPaymentId
    ? {
        ...enrollment,
        payments: enrollment.payments.filter((payment) => payment.id !== ignoredPaymentId),
      }
    : enrollment;

  return buildEnrollmentFinancials(scopedEnrollment).debt;
};

// Функция resolveConfirmedStatus: определяет итоговое значение по входным данным.
const resolveConfirmedStatus = (enrollment, payment) => {
  const alreadyPaid = enrollment.payments
    .filter(
      (entry) =>
        entry.id !== payment.id && countableStatuses.has(entry.status),
    )
    .reduce((sum, entry) => sum + Number(entry.amount), 0);

  const totalAfterConfirmation = alreadyPaid + Number(payment.amount);
  return totalAfterConfirmation >= Number(enrollment.lesson.price)
    ? "SUCCEEDED"
    : "PARTIAL";
};

// Служебная функция ensurePaymentAccess: инкапсулирует отдельный шаг логики этого модуля.
const ensurePaymentAccess = (payment, user) => {
  if (user.role === "PARENT" && payment.parentId !== user.id) {
    throw { status: 403, message: "You can access only your own payments" };
  }
};

// REST-маршрут GET /my: обрабатывает запросы этого модуля.
router.get(
  "/my",
  requireRoles("PARENT"),
  asyncHandler(async (req, res) => {
    const payments = await prisma.payment.findMany({
      where: {
        parentId: req.user.id,
      },
      include: paymentInclude,
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    });

    res.json({
      items: payments.map(serializePayment),
    });
  }),
);

// REST-маршрут GET /: обрабатывает запросы этого модуля.
router.get(
  "/",
  requireRoles("ADMIN"),
  asyncHandler(async (_req, res) => {
    const payments = await prisma.payment.findMany({
      include: paymentInclude,
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    });

    res.json({
      items: payments.map(serializePayment),
    });
  }),
);

// REST-маршрут GET /export: обрабатывает запросы этого модуля.
router.get(
  "/export",
  requireRoles("ADMIN"),
  asyncHandler(async (req, res) => {
    const query = exportQuerySchema.parse(req.query);
    const { from, to } = getDateRange(query);

    const payments = await prisma.payment.findMany({
      where: {
        OR: [
          { paidAt: { gte: from, lte: to } },
          {
            paidAt: null,
            createdAt: { gte: from, lte: to },
          },
        ],
      },
      include: paymentInclude,
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    });

    const rows = payments.map((payment) => ({
      "Дата": formatDateCell(payment.paidAt || payment.createdAt),
      "Ученик": payment.enrollment?.child?.fullName || "",
      "Услуга": payment.serviceLabel || payment.enrollment?.lesson?.title || "",
      "Сумма": Number(payment.amount),
      "Тип оплаты": payment.method,
      "Статус": payment.status,
      "Сотрудник": payment.recordedBy?.fullName || "Система",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Payments");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="payments-${from.toISOString().slice(0, 10)}-${to
        .toISOString()
        .slice(0, 10)}.xlsx"`,
    );
    res.send(buffer);
  }),
);

// REST-маршрут POST /manual: обрабатывает запросы этого модуля.
router.post(
  "/manual",
  requireRoles("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = manualPaymentSchema.parse(req.body);
    const enrollment = await loadEnrollment(data.enrollmentId);

    if (enrollment.status === "CANCELLED") {
      throw { status: 400, message: "Cancelled enrollment cannot be paid" };
    }

    const outstanding = getOutstandingForEnrollment(enrollment);

    if (outstanding <= 0) {
      throw { status: 409, message: "This enrollment is already paid" };
    }

    if (data.amount > outstanding) {
      throw { status: 400, message: "Payment amount cannot exceed the outstanding debt" };
    }

    if (data.status === "SUCCEEDED" && data.amount < outstanding) {
      throw { status: 400, message: "Full payment must cover the remaining debt" };
    }

    if (data.status === "PARTIAL" && data.amount >= outstanding) {
      throw { status: 400, message: "Partial payment must be smaller than the remaining debt" };
    }

    if (enrollment.payments.some((payment) => payment.status === "PENDING")) {
      throw { status: 409, message: "There is already a pending payment for this enrollment" };
    }

    const paidAt =
      data.status === "PENDING" ? null : data.paymentDate || new Date();

    const payment = await prisma.payment.create({
      data: {
        parentId: enrollment.child.parentId,
        enrollmentId: enrollment.id,
        amount: data.amount.toFixed(2),
        currency: "kzt",
        status: data.status,
        method: data.method,
        serviceLabel: data.serviceLabel || enrollment.lesson.title,
        comment: data.comment || null,
        recordedById: req.user.id,
        paidAt,
      },
      include: paymentInclude,
    });

    await addPaymentHistory({
      paymentId: payment.id,
      fromStatus: null,
      toStatus: payment.status,
      comment: data.comment,
      createdById: req.user.id,
    });

    if (payment.status !== "PENDING") {
      await createNotification({
        userId: payment.parentId,
        email: payment.enrollment.child.parent.email,
        title: payment.status === "PARTIAL" ? "Частичная оплата принята" : "Оплата принята",
        message:
          payment.status === "PARTIAL"
            ? `По занятию «${payment.enrollment.lesson.title}» зафиксирована частичная оплата на сумму ${Number(payment.amount)} KZT.`
            : `Оплата за занятие «${payment.enrollment.lesson.title}» успешно принята сотрудником центра.`,
        type: "PAYMENT_CONFIRMED",
        channel: "EMAIL",
      });
    }

    const refreshedPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: paymentInclude,
    });

    res.status(201).json({
      payment: serializePayment(refreshedPayment),
    });
  }),
);

// REST-маршрут POST /create-intent: обрабатывает запросы этого модуля.
router.post(
  "/create-intent",
  asyncHandler(async (req, res) => {
    const data = createIntentSchema.parse(req.body);
    const enrollment = await loadEnrollment(data.enrollmentId);

    if (req.user.role === "PARENT" && enrollment.child.parentId !== req.user.id) {
      throw { status: 403, message: "You can pay only for your own enrollment" };
    }

    if (enrollment.status === "CANCELLED") {
      throw { status: 400, message: "Cancelled enrollment cannot be paid" };
    }

    const outstanding = getOutstandingForEnrollment(enrollment);

    if (outstanding <= 0) {
      throw { status: 409, message: "This enrollment is already paid" };
    }

    if (enrollment.payments.some((payment) => payment.status === "PENDING")) {
      throw { status: 409, message: "There is already a pending payment for this enrollment" };
    }

    const amount = Number(outstanding.toFixed(2));
    const currency = (data.currency || env.stripe.currency || "kzt").toLowerCase();
    let stripePaymentIntentId = `mock_pi_${Date.now()}`;
    let clientSecret = `mock_secret_${Date.now()}`;
    let mode = "mock";

    if (stripe) {
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency,
        metadata: {
          enrollmentId: enrollment.id,
          parentId: enrollment.child.parentId,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      stripePaymentIntentId = intent.id;
      clientSecret = intent.client_secret;
      mode = "stripe";
    }

    const payment = await prisma.payment.create({
      data: {
        parentId: enrollment.child.parentId,
        enrollmentId: enrollment.id,
        amount: amount.toFixed(2),
        currency,
        status: "PENDING",
        method: "STRIPE",
        serviceLabel: enrollment.lesson.title,
        stripePaymentIntentId,
        clientSecret,
      },
      include: paymentInclude,
    });

    await addPaymentHistory({
      paymentId: payment.id,
      fromStatus: null,
      toStatus: "PENDING",
      comment: "Создан платёж для оплаты через Stripe",
      createdById: req.user.id,
    });

    res.status(201).json({
      mode,
      publishableKey: stripe ? env.stripe.publishableKey : null,
      clientSecret,
      payment: serializePayment(payment),
    });
  }),
);

// REST-маршрут POST /:id/confirm: обрабатывает запросы этого модуля.
router.post(
  "/:id/confirm",
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: paymentInclude,
    });

    if (!payment) {
      throw { status: 404, message: "Payment not found" };
    }

    ensurePaymentAccess(payment, req.user);

    if (payment.status !== "PENDING") {
      return res.json({
        payment: serializePayment(payment),
      });
    }

    if (
      payment.method === "STRIPE" &&
      stripe &&
      payment.stripePaymentIntentId &&
      !payment.stripePaymentIntentId.startsWith("mock_")
    ) {
      const intent = await stripe.paymentIntents.retrieve(
        payment.stripePaymentIntentId,
      );

      if (intent.status !== "succeeded") {
        throw {
          status: 400,
          message: "Stripe payment is not completed yet",
        };
      }
    }

    const targetStatus = resolveConfirmedStatus(payment.enrollment, payment);

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: targetStatus,
        paidAt: payment.paidAt || new Date(),
        recordedById:
          req.user.role === "ADMIN" ? req.user.id : payment.recordedById,
      },
      include: paymentInclude,
    });

    await addPaymentHistory({
      paymentId: updatedPayment.id,
      fromStatus: "PENDING",
      toStatus: targetStatus,
      comment: updatedPayment.comment || "Платёж подтверждён",
      createdById: req.user.id,
    });

    await createNotification({
      userId: updatedPayment.parentId,
      email: updatedPayment.enrollment.child.parent.email,
      title:
        targetStatus === "PARTIAL"
          ? "Частичная оплата подтверждена"
          : "Оплата подтверждена",
      message:
        targetStatus === "PARTIAL"
          ? `По занятию «${updatedPayment.enrollment.lesson.title}» подтверждена частичная оплата.`
          : `Оплата за занятие «${updatedPayment.enrollment.lesson.title}» успешно получена.`,
      type: "PAYMENT_CONFIRMED",
      channel: "EMAIL",
    });

    const refreshedPayment = await prisma.payment.findUnique({
      where: { id: updatedPayment.id },
      include: paymentInclude,
    });

    res.json({
      payment: serializePayment(refreshedPayment),
    });
  }),
);

module.exports = router;
