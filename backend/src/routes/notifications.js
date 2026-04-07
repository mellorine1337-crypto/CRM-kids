const express = require("express");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");
const { serializeNotification } = require("../utils/serializers");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: { sentAt: "desc" },
    });

    res.json({
      items: notifications.map(serializeNotification),
    });
  }),
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!notification) {
      throw { status: 404, message: "Notification not found" };
    }

    const updatedNotification = await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
    });

    res.json({
      notification: serializeNotification(updatedNotification),
    });
  }),
);

module.exports = router;
