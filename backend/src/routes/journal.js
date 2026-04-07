const express = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { createNotification } = require("../lib/notifications");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");
const { serializeJournalEntry } = require("../utils/serializers");

const router = express.Router();

const upsertJournalSchema = z.object({
  enrollmentId: z.string(),
  topicSummary: z.string().trim().max(2000).optional().nullable(),
  homeworkTitle: z.string().trim().max(160).optional().nullable(),
  homeworkDescription: z.string().trim().max(2000).optional().nullable(),
  homeworkDueDate: z.coerce.date().optional().nullable(),
  homeworkStatus: z
    .enum(["ASSIGNED", "SUBMITTED", "REVIEWED", "OVERDUE"])
    .optional()
    .nullable(),
  score: z.number().int().min(0).max(100).optional().nullable(),
  progressLevel: z
    .enum(["EXCELLENT", "GOOD", "ATTENTION_REQUIRED"])
    .optional()
    .nullable(),
  teacherComment: z.string().trim().max(2000).optional().nullable(),
});

const parentCommentSchema = z.object({
  parentComment: z.string().trim().min(2).max(2000),
});

const journalInclude = {
  creator: true,
  updater: true,
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
          enrollments: {
            select: {
              status: true,
            },
          },
        },
      },
      attendance: true,
      payments: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  },
};

const buildScope = (user, childId) => ({
  ...(user.role === "PARENT"
    ? {
        enrollment: {
          child: {
            parentId: user.id,
            ...(childId ? { id: childId } : {}),
          },
        },
      }
    : childId
      ? {
          enrollment: {
            childId,
          },
        }
      : {}),
});

const normalizeHomeworkStatus = (inputStatus, dueDate) => {
  if (!dueDate) {
    return inputStatus ?? null;
  }

  if (!inputStatus || inputStatus === "ASSIGNED") {
    const dueDateTime = new Date(dueDate);

    if (dueDateTime < new Date()) {
      return "OVERDUE";
    }
  }

  return inputStatus ?? "ASSIGNED";
};

const loadJournalEntry = async (id, user) => {
  const entry = await prisma.journalEntry.findFirst({
    where: {
      id,
      ...buildScope(user),
    },
    include: journalInclude,
  });

  if (!entry) {
    throw { status: 404, message: "Journal entry not found" };
  }

  return entry;
};

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const childId = typeof req.query.childId === "string" ? req.query.childId : undefined;
    const entries = await prisma.journalEntry.findMany({
      where: buildScope(req.user, childId),
      include: journalInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    res.json({
      items: entries.map(serializeJournalEntry),
    });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const entry = await loadJournalEntry(req.params.id, req.user);

    res.json({
      entry: serializeJournalEntry(entry),
    });
  }),
);

router.post(
  "/",
  requireRoles("STAFF"),
  asyncHandler(async (req, res) => {
    const data = upsertJournalSchema.parse(req.body);
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: data.enrollmentId },
      include: {
        child: {
          include: {
            parent: true,
          },
        },
        lesson: true,
      },
    });

    if (!enrollment) {
      throw { status: 404, message: "Enrollment not found" };
    }

    const payload = {
      topicSummary: data.topicSummary || null,
      homeworkTitle: data.homeworkTitle || null,
      homeworkDescription: data.homeworkDescription || null,
      homeworkDueDate: data.homeworkDueDate || null,
      homeworkStatus: normalizeHomeworkStatus(data.homeworkStatus, data.homeworkDueDate),
      score: data.score ?? null,
      progressLevel: data.progressLevel || null,
      teacherComment: data.teacherComment || null,
      updatedBy: req.user.id,
    };

    const existing = await prisma.journalEntry.findUnique({
      where: { enrollmentId: enrollment.id },
    });

    const entry = existing
      ? await prisma.journalEntry.update({
          where: { id: existing.id },
          data: payload,
          include: journalInclude,
        })
      : await prisma.journalEntry.create({
          data: {
            enrollmentId: enrollment.id,
            createdBy: req.user.id,
            ...payload,
          },
          include: journalInclude,
        });

    await createNotification({
      userId: enrollment.child.parent.id,
      email: enrollment.child.parent.email,
      title: "Журнал обновлён",
      message: `По занятию «${enrollment.lesson.title}» обновлены домашнее задание и прогресс ребёнка ${enrollment.child.fullName}.`,
      type: "SYSTEM",
      channel: "EMAIL",
    });

    res.status(existing ? 200 : 201).json({
      entry: serializeJournalEntry(entry),
    });
  }),
);

router.patch(
  "/:id/parent-comment",
  requireRoles("PARENT"),
  asyncHandler(async (req, res) => {
    const data = parentCommentSchema.parse(req.body);
    const entry = await loadJournalEntry(req.params.id, req.user);

    const updatedEntry = await prisma.journalEntry.update({
      where: { id: entry.id },
      data: {
        parentComment: data.parentComment,
        updatedBy: req.user.id,
      },
      include: journalInclude,
    });

    await createNotification({
      userId: updatedEntry.creator.id,
      title: "Новый комментарий родителя",
      message: `Родитель оставил комментарий по журналу занятия «${updatedEntry.enrollment.lesson.title}».`,
      type: "SYSTEM",
    });

    res.json({
      entry: serializeJournalEntry(updatedEntry),
    });
  }),
);

module.exports = router;
