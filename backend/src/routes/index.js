// Кратко: собирает все API-модули в единый роутер /api.
const express = require("express");
const authRoutes = require("./auth");
const userRoutes = require("./users");
const childrenRoutes = require("./children");
const lessonRoutes = require("./lessons");
const enrollmentRoutes = require("./enrollments");
const paymentRoutes = require("./payments");
const attendanceRoutes = require("./attendance");
const analyticsRoutes = require("./analytics");
const journalRoutes = require("./journal");
const recommendationRoutes = require("./recommendations");
const integrationRoutes = require("./integrations");
const notificationRoutes = require("./notifications");
const feedbackRoutes = require("./feedback");
const uploadRoutes = require("./uploads");

const router = express.Router();

// REST-маршрут GET ok: обрабатывает запросы этого модуля.
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// REST-маршрут USE /users: обрабатывает запросы этого модуля.
router.use("/auth", authRoutes);
// REST-маршрут USE /children: обрабатывает запросы этого модуля.
router.use("/users", userRoutes);
// REST-маршрут USE /lessons: обрабатывает запросы этого модуля.
router.use("/children", childrenRoutes);
// REST-маршрут USE /enrollments: обрабатывает запросы этого модуля.
router.use("/lessons", lessonRoutes);
// REST-маршрут USE /payments: обрабатывает запросы этого модуля.
router.use("/enrollments", enrollmentRoutes);
// REST-маршрут USE /attendance: обрабатывает запросы этого модуля.
router.use("/payments", paymentRoutes);
// REST-маршрут USE /analytics: обрабатывает запросы этого модуля.
router.use("/attendance", attendanceRoutes);
// REST-маршрут USE /journal: обрабатывает запросы этого модуля.
router.use("/analytics", analyticsRoutes);
// REST-маршрут USE /recommendations: обрабатывает запросы этого модуля.
router.use("/journal", journalRoutes);
// REST-маршрут USE /integrations: обрабатывает запросы этого модуля.
router.use("/recommendations", recommendationRoutes);
// REST-маршрут USE /notifications: обрабатывает запросы этого модуля.
router.use("/integrations", integrationRoutes);
// REST-маршрут USE /feedback: обрабатывает запросы этого модуля.
router.use("/notifications", notificationRoutes);
// REST-маршрут USE /uploads: обрабатывает запросы этого модуля.
router.use("/feedback", feedbackRoutes);
// REST-маршрут USE: обрабатывает запросы этого модуля.
router.use("/uploads", uploadRoutes);

module.exports = router;
