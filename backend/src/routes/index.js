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

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/children", childrenRoutes);
router.use("/lessons", lessonRoutes);
router.use("/enrollments", enrollmentRoutes);
router.use("/payments", paymentRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/journal", journalRoutes);
router.use("/recommendations", recommendationRoutes);
router.use("/integrations", integrationRoutes);
router.use("/notifications", notificationRoutes);
router.use("/feedback", feedbackRoutes);
router.use("/uploads", uploadRoutes);

module.exports = router;
