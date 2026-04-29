const express = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { createNotification } = require("../lib/notifications");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");
const { serializeLesson } = require("../utils/serializers");

const router = express.Router();

const lessonBaseSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(1500).optional().nullable(),
  ageMin: z.coerce.number().int().min(0).max(18),
  ageMax: z.coerce.number().int().min(0).max(18),
  date: z.coerce.date(),
  startTime: z.string().min(4).max(10),
  endTime: z.string().min(4).max(10),
  capacity: z.coerce.number().int().min(1).max(500),
  teacherId: z.string().optional().nullable(),
  teacherName: z.string().min(2).max(120),
  price: z.coerce.number().min(0),
});

const lessonSchema = lessonBaseSchema
  .refine((value) => value.ageMin <= value.ageMax, {
    message: "ageMin must be less than or equal to ageMax",
    path: ["ageMin"],
  });

const lessonUpdateSchema = lessonBaseSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    {
      message: "At least one field must be provided",
    },
  )
  .refine(
    (value) =>
      value.ageMin === undefined ||
      value.ageMax === undefined ||
      value.ageMin <= value.ageMax,
    {
      message: "ageMin must be less than or equal to ageMax",
      path: ["ageMin"],
    },
  );

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { date, age, title } = req.query;
    const where = {};

    if (req.user.role === "TEACHER") {
      where.OR = [
        { teacherId: req.user.id },
        { teacherName: req.user.fullName },
      ];
    }

    if (title) {
      where.title = { contains: String(title), mode: "insensitive" };
    }

    if (age) {
      const ageValue = Number(age);
      where.ageMin = { lte: ageValue };
      where.ageMax = { gte: ageValue };
    }

    if (date) {
      const start = new Date(String(date));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.date = { gte: start, lt: end };
    }

    const lessons = await prisma.lesson.findMany({
      where,
      include: {
        creator: true,
        teacher: true,
        enrollments: { select: { status: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    res.json({
      items: lessons.map(serializeLesson),
    });
  }),
);

router.post(
  "/",
  requireRoles("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = lessonSchema.parse(req.body);
    let teacherName = data.teacherName;

    if (data.teacherId) {
      const teacher = await prisma.user.findUnique({
        where: { id: data.teacherId },
      });

      if (!teacher || teacher.role !== "TEACHER") {
        throw { status: 400, message: "User not found" };
      }

      teacherName = teacher.fullName;
    }

    const lesson = await prisma.lesson.create({
      data: {
        title: data.title,
        description: data.description || null,
        ageMin: data.ageMin,
        ageMax: data.ageMax,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        capacity: data.capacity,
        teacherId: data.teacherId || null,
        teacherName,
        price: data.price.toFixed(2),
        createdBy: req.user.id,
      },
      include: {
        creator: true,
        teacher: true,
        enrollments: { select: { status: true } },
      },
    });

    res.status(201).json({
      lesson: serializeLesson(lesson),
    });
  }),
);

router.patch(
  "/:id",
  requireRoles("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = lessonUpdateSchema.parse(req.body);
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: {
        creator: true,
        teacher: true,
        enrollments: { select: { status: true } },
      },
    });

    if (!lesson) {
      throw { status: 404, message: "Lesson not found" };
    }

    let teacherName = data.teacherName;

    if (data.teacherId) {
      const teacher = await prisma.user.findUnique({
        where: { id: data.teacherId },
      });

      if (!teacher || teacher.role !== "TEACHER") {
        throw { status: 400, message: "User not found" };
      }

      teacherName = teacher.fullName;
    }

    const updatedLesson = await prisma.lesson.update({
      where: { id: lesson.id },
      data: {
        title: data.title,
        description: data.description,
        ageMin: data.ageMin,
        ageMax: data.ageMax,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        capacity: data.capacity,
        teacherId: data.teacherId !== undefined ? data.teacherId || null : undefined,
        teacherName: teacherName || undefined,
        price: data.price !== undefined ? data.price.toFixed(2) : undefined,
      },
      include: {
        creator: true,
        teacher: true,
        enrollments: { select: { status: true } },
      },
    });

    res.json({
      lesson: serializeLesson(updatedLesson),
    });
  }),
);

router.delete(
  "/:id",
  requireRoles("ADMIN"),
  asyncHandler(async (req, res) => {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: {
        enrollments: {
          include: {
            child: {
              include: {
                parent: true,
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      throw { status: 404, message: "Lesson not found" };
    }

    await Promise.all(
      lesson.enrollments.map((enrollment) =>
        createNotification({
          userId: enrollment.child.parent.id,
          email: enrollment.child.parent.email,
          title: "Занятие отменено",
          message: `Занятие «${lesson.title}», запланированное на ${lesson.date.toDateString()}, отменено.`,
          type: "CLASS_CANCELLED",
          channel: "EMAIL",
        }),
      ),
    );

    await prisma.lesson.delete({
      where: { id: lesson.id },
    });

    res.status(204).send();
  }),
);

module.exports = router;
