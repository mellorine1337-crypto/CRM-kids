const express = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { createNotification } = require("../lib/notifications");
const { signAttendanceQrToken, verifyAttendanceQrToken } = require("../lib/tokens");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");

const router = express.Router();

const attendanceSchema = z.object({
  enrollmentId: z.string(),
  status: z.enum(["PRESENT", "ABSENT"]),
  comment: z.string().max(1000).optional().nullable(),
});

const attendanceQrScanSchema = z.object({
  qrToken: z.string().min(10),
  comment: z.string().max(1000).optional().nullable(),
});

router.use(requireAuth);

const loadEnrollment = async (enrollmentId) => {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      child: {
        include: {
          parent: true,
        },
      },
      lesson: true,
      attendance: true,
    },
  });

  if (!enrollment) {
    throw { status: 404, message: "Enrollment not found" };
  }

  return enrollment;
};

const saveAttendance = async ({ enrollmentId, status, comment, markedBy }) => {
  const attendance = await prisma.attendance.upsert({
    where: {
      enrollmentId,
    },
    update: {
      status,
      comment: comment || null,
      markedBy,
      markedAt: new Date(),
    },
    create: {
      enrollmentId,
      status,
      comment: comment || null,
      markedBy,
    },
  });

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      status: status === "PRESENT" ? "ATTENDED" : "MISSED",
    },
  });

  return attendance;
};

router.post(
  "/",
  requireRoles("STAFF"),
  asyncHandler(async (req, res) => {
    const data = attendanceSchema.parse(req.body);
    await loadEnrollment(data.enrollmentId);
    const attendance = await saveAttendance({
      enrollmentId: data.enrollmentId,
      status: data.status,
      comment: data.comment,
      markedBy: req.user.id,
    });

    res.status(201).json({
      attendance: {
        id: attendance.id,
        enrollmentId: attendance.enrollmentId,
        status: attendance.status,
        comment: attendance.comment,
        markedBy: attendance.markedBy,
        markedAt: attendance.markedAt,
      },
    });
  }),
);

router.get(
  "/qr/:enrollmentId",
  asyncHandler(async (req, res) => {
    const enrollment = await loadEnrollment(req.params.enrollmentId);

    if (req.user.role === "PARENT" && enrollment.child.parentId !== req.user.id) {
      throw { status: 403, message: "You can view only your own attendance QR" };
    }

    if (enrollment.status === "CANCELLED") {
      throw { status: 400, message: "Cancelled enrollment cannot generate attendance QR" };
    }

    const qrToken = signAttendanceQrToken(enrollment);
    const decoded = verifyAttendanceQrToken(qrToken);
    const expiresAt = new Date(decoded.exp * 1000);

    res.json({
      qr: {
        qrToken,
        expiresAt,
        enrollment: {
          id: enrollment.id,
          status: enrollment.status,
          child: {
            id: enrollment.child.id,
            fullName: enrollment.child.fullName,
          },
          lesson: {
            id: enrollment.lesson.id,
            title: enrollment.lesson.title,
            date: enrollment.lesson.date,
            startTime: enrollment.lesson.startTime,
            teacherName: enrollment.lesson.teacherName,
          },
        },
      },
    });
  }),
);

router.post(
  "/scan",
  requireRoles("STAFF"),
  asyncHandler(async (req, res) => {
    const data = attendanceQrScanSchema.parse(req.body);

    let payload;

    try {
      payload = verifyAttendanceQrToken(data.qrToken);
    } catch (_error) {
      throw { status: 400, message: "Invalid attendance QR token" };
    }

    const enrollment = await loadEnrollment(payload.sub);

    if (enrollment.status === "CANCELLED") {
      throw { status: 400, message: "Cancelled enrollment cannot be checked in" };
    }

    const attendance = await saveAttendance({
      enrollmentId: enrollment.id,
      status: "PRESENT",
      comment: data.comment || "QR check-in",
      markedBy: req.user.id,
    });

    await createNotification({
      userId: enrollment.child.parent.id,
      email: enrollment.child.parent.email,
      title: "Посещение подтверждено по QR",
      message: `${enrollment.child.fullName} отмечен(а) на занятии «${enrollment.lesson.title}» через QR.`,
      type: "SYSTEM",
      channel: "EMAIL",
    });

    res.json({
      attendance: {
        id: attendance.id,
        enrollmentId: attendance.enrollmentId,
        status: attendance.status,
        comment: attendance.comment,
        markedBy: attendance.markedBy,
        markedAt: attendance.markedAt,
      },
      enrollment: {
        id: enrollment.id,
        status: "ATTENDED",
        child: {
          id: enrollment.child.id,
          fullName: enrollment.child.fullName,
        },
        lesson: {
          id: enrollment.lesson.id,
          title: enrollment.lesson.title,
          date: enrollment.lesson.date,
          startTime: enrollment.lesson.startTime,
        },
      },
    });
  }),
);

router.get(
  "/:lessonId",
  asyncHandler(async (req, res) => {
    const where =
      req.user.role === "PARENT"
        ? {
            enrollment: {
              lessonId: req.params.lessonId,
              child: {
                parentId: req.user.id,
              },
            },
          }
        : {
            enrollment: {
              lessonId: req.params.lessonId,
            },
          };

    const items = await prisma.attendance.findMany({
      where,
      include: {
        marker: true,
        enrollment: {
          include: {
            child: true,
            lesson: true,
          },
        },
      },
      orderBy: { markedAt: "desc" },
    });

    res.json({
      items: items.map((item) => ({
        id: item.id,
        status: item.status,
        comment: item.comment,
        markedAt: item.markedAt,
        markedBy: {
          id: item.marker.id,
          fullName: item.marker.fullName,
          role: item.marker.role,
        },
        enrollment: {
          id: item.enrollment.id,
          status: item.enrollment.status,
          child: {
            id: item.enrollment.child.id,
            fullName: item.enrollment.child.fullName,
          },
          lesson: {
            id: item.enrollment.lesson.id,
            title: item.enrollment.lesson.title,
            date: item.enrollment.lesson.date,
          },
        },
      })),
    });
  }),
);

module.exports = router;
