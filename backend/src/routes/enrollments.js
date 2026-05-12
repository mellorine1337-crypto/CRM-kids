// Кратко: отвечает за записи детей на занятия и проверку бизнес-ограничений.
const express = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { createNotification } = require("../lib/notifications");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");
const { calculateAge } = require("../utils/date");
const { serializeEnrollment } = require("../utils/serializers");

const router = express.Router();

const createEnrollmentSchema = z.object({
  childId: z.string(),
  lessonId: z.string(),
});

// REST-маршрут USE: обрабатывает запросы этого модуля.
router.use(requireAuth);

const enrollmentInclude = {
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
  attendance: true,
  payments: {
    orderBy: { createdAt: "desc" },
  },
};

// REST-маршрут POST /: обрабатывает запросы этого модуля.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createEnrollmentSchema.parse(req.body);
    const child = await prisma.child.findUnique({
      where: { id: data.childId },
      include: { parent: true },
    });

    if (!child) {
      throw { status: 404, message: "Child not found" };
    }

    if (req.user.role === "PARENT" && child.parentId !== req.user.id) {
      throw { status: 403, message: "You can enroll only your own child" };
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: data.lessonId },
      include: {
        creator: true,
        enrollments: { select: { status: true } },
      },
    });

    if (!lesson) {
      throw { status: 404, message: "Lesson not found" };
    }

    const childAge = calculateAge(child.birthDate);

    if (childAge < lesson.ageMin || childAge > lesson.ageMax) {
      throw {
        status: 400,
        message: "Child age does not match the lesson age range",
      };
    }

    const activeCount = lesson.enrollments.filter(
      (item) => item.status !== "CANCELLED",
    ).length;

    if (activeCount >= lesson.capacity) {
      throw { status: 409, message: "No free spots available for this lesson" };
    }

    const existing = await prisma.enrollment.findUnique({
      where: {
        childId_lessonId: {
          childId: data.childId,
          lessonId: data.lessonId,
        },
      },
      include: enrollmentInclude,
    });

    let enrollment;

    if (existing && existing.status !== "CANCELLED") {
      throw { status: 409, message: "Child is already enrolled in this lesson" };
    }

    if (existing && existing.status === "CANCELLED") {
      enrollment = await prisma.enrollment.update({
        where: { id: existing.id },
        data: { status: "BOOKED" },
        include: enrollmentInclude,
      });
    } else {
      enrollment = await prisma.enrollment.create({
        data: {
          childId: data.childId,
          lessonId: data.lessonId,
          status: "BOOKED",
        },
        include: enrollmentInclude,
      });
    }

    await createNotification({
      userId: child.parent.id,
      email: child.parent.email,
      title: "Запись подтверждена",
      message: `${child.fullName} записан(а) на занятие «${lesson.title}» ${lesson.date.toDateString()} в ${lesson.startTime}.`,
      type: "ENROLLMENT_CONFIRMED",
      channel: "EMAIL",
    });

    res.status(201).json({
      enrollment: serializeEnrollment(enrollment),
    });
  }),
);

// REST-маршрут GET /my: обрабатывает запросы этого модуля.
router.get(
  "/my",
  requireRoles("PARENT"),
  asyncHandler(async (req, res) => {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        child: {
          parentId: req.user.id,
        },
      },
      include: enrollmentInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json({
      items: enrollments.map(serializeEnrollment),
    });
  }),
);

// REST-маршрут GET /: обрабатывает запросы этого модуля.
router.get(
  "/",
  requireRoles("ADMIN", "TEACHER"),
  asyncHandler(async (req, res) => {
    const enrollments = await prisma.enrollment.findMany({
      where:
        req.user.role === "TEACHER"
          ? {
              lesson: {
                OR: [
                  { teacherId: req.user.id },
                  { teacherName: req.user.fullName },
                ],
              },
            }
          : undefined,
      include: enrollmentInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json({
      items: enrollments.map(serializeEnrollment),
    });
  }),
);

// REST-маршрут PATCH /:id/cancel: обрабатывает запросы этого модуля.
router.patch(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: req.params.id },
      include: enrollmentInclude,
    });

    if (!enrollment) {
      throw { status: 404, message: "Enrollment not found" };
    }

    if (
      req.user.role === "PARENT" &&
      enrollment.child.parentId !== req.user.id
    ) {
      throw { status: 403, message: "You can cancel only your own enrollments" };
    }

    const updatedEnrollment = await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "CANCELLED" },
      include: enrollmentInclude,
    });

    res.json({
      enrollment: serializeEnrollment(updatedEnrollment),
    });
  }),
);

module.exports = router;
