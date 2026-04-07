const express = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { createNotification } = require("../lib/notifications");
const { stripe } = require("../lib/stripe");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");
const { serializePayment } = require("../utils/serializers");
const { env } = require("../config/env");

const router = express.Router();

const createIntentSchema = z.object({
  enrollmentId: z.string(),
  currency: z.string().min(3).max(3).optional(),
});

router.use(requireAuth);

const paymentInclude = {
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
    },
  },
};

router.get(
  "/my",
  requireRoles("PARENT"),
  asyncHandler(async (req, res) => {
    const payments = await prisma.payment.findMany({
      where: {
        parentId: req.user.id,
      },
      include: paymentInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json({
      items: payments.map(serializePayment),
    });
  }),
);

router.get(
  "/",
  requireRoles("STAFF"),
  asyncHandler(async (_req, res) => {
    const payments = await prisma.payment.findMany({
      include: paymentInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json({
      items: payments.map(serializePayment),
    });
  }),
);

router.post(
  "/create-intent",
  asyncHandler(async (req, res) => {
    const data = createIntentSchema.parse(req.body);
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: data.enrollmentId },
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
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!enrollment) {
      throw { status: 404, message: "Enrollment not found" };
    }

    if (
      req.user.role === "PARENT" &&
      enrollment.child.parentId !== req.user.id
    ) {
      throw { status: 403, message: "You can pay only for your own enrollment" };
    }

    if (enrollment.status === "CANCELLED") {
      throw { status: 400, message: "Cancelled enrollment cannot be paid" };
    }

    const alreadyPaid = enrollment.payments.find(
      (payment) => payment.status === "SUCCEEDED",
    );

    if (alreadyPaid) {
      throw { status: 409, message: "This enrollment is already paid" };
    }

    const amount = Number(enrollment.lesson.price);
    const currency = (data.currency || env.stripe.currency).toLowerCase();
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
        stripePaymentIntentId,
        clientSecret,
      },
      include: paymentInclude,
    });

    res.status(201).json({
      mode,
      publishableKey: stripe ? env.stripe.publishableKey : null,
      clientSecret,
      payment: serializePayment(payment),
    });
  }),
);

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

    if (req.user.role === "PARENT" && payment.parentId !== req.user.id) {
      throw { status: 403, message: "You can confirm only your own payments" };
    }

    if (payment.status === "SUCCEEDED") {
      return res.json({
        payment: serializePayment(payment),
      });
    }

    if (
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

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCEEDED" },
      include: paymentInclude,
    });

    await createNotification({
      userId: updatedPayment.parentId,
      email: updatedPayment.enrollment.child.parent.email,
      title: "Оплата подтверждена",
      message: `Оплата за занятие «${updatedPayment.enrollment.lesson.title}» успешно получена.`,
      type: "PAYMENT_CONFIRMED",
      channel: "EMAIL",
    });

    res.json({
      payment: serializePayment(updatedPayment),
    });
  }),
);

module.exports = router;
