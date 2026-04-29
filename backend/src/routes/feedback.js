const express = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { createNotification } = require("../lib/notifications");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");
const {
  serializeChild,
  serializeFeedbackMessage,
  serializeFeedbackThread,
  serializeUser,
} = require("../utils/serializers");

const router = express.Router();

const createThreadSchema = z.object({
  subject: z.string().trim().min(2).max(140),
  message: z.string().trim().min(2).max(2000),
  staffId: z.string().optional(),
  parentId: z.string().optional(),
  childId: z.string().optional().nullable(),
});

const createMessageSchema = z.object({
  body: z.string().trim().min(2).max(2000),
});

const summaryInclude = {
  parent: true,
  staff: true,
  child: {
    include: {
      parent: true,
    },
  },
  messages: {
    orderBy: {
      createdAt: "desc",
    },
    take: 1,
    include: {
      sender: true,
    },
  },
};

const detailInclude = {
  parent: true,
  staff: true,
  child: {
    include: {
      parent: true,
    },
  },
  messages: {
    orderBy: {
      createdAt: "asc",
    },
    include: {
      sender: true,
    },
  },
};

const getScope = (user) => ({
  ...(user.role === "PARENT" ? { parentId: user.id } : { staffId: user.id }),
});

const toSummary = (thread) =>
  serializeFeedbackThread({
    ...thread,
    latestMessage: thread.messages?.[0],
    messages: undefined,
  });

const loadThread = async (threadId, user, include) => {
  const thread = await prisma.feedbackThread.findFirst({
    where: {
      id: threadId,
      ...getScope(user),
    },
    include,
  });

  if (!thread) {
    throw { status: 404, message: "Feedback thread not found" };
  }

  return thread;
};

router.use(requireAuth);
router.use(requireRoles("PARENT", "TEACHER"));

router.get(
  "/options",
  asyncHandler(async (req, res) => {
    if (req.user.role === "PARENT") {
      const [staffUsers, children] = await Promise.all([
        prisma.user.findMany({
          where: { role: "TEACHER" },
          orderBy: { fullName: "asc" },
        }),
        prisma.child.findMany({
          where: { parentId: req.user.id },
          include: { parent: true },
          orderBy: { fullName: "asc" },
        }),
      ]);

      return res.json({
        staff: staffUsers.map(serializeUser),
        parents: [],
        children: children.map(serializeChild),
      });
    }

    const [parents, children] = await Promise.all([
      prisma.user.findMany({
        where: { role: "PARENT" },
        orderBy: { fullName: "asc" },
      }),
      prisma.child.findMany({
        include: { parent: true },
        orderBy: { fullName: "asc" },
      }),
    ]);

    res.json({
      staff: [serializeUser(req.user)],
      parents: parents.map(serializeUser),
      children: children.map(serializeChild),
    });
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const threads = await prisma.feedbackThread.findMany({
      where: getScope(req.user),
      include: summaryInclude,
      orderBy: { lastMessageAt: "desc" },
    });

    res.json({
      items: threads.map(toSummary),
    });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    await loadThread(req.params.id, req.user, summaryInclude);

    await prisma.feedbackMessage.updateMany({
      where: {
        threadId: req.params.id,
        senderId: { not: req.user.id },
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    const thread = await loadThread(req.params.id, req.user, detailInclude);

    res.json({
      thread: serializeFeedbackThread(thread),
    });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createThreadSchema.parse(req.body);
    const subject = data.subject.trim();
    const messageBody = data.message.trim();
    const childId = data.childId || null;

    let parentId = req.user.id;
    let staffId = req.user.id;

    if (req.user.role === "PARENT") {
      if (!data.staffId) {
        throw { status: 400, message: "Staff recipient was not found" };
      }

      staffId = data.staffId;
    } else {
      if (!data.parentId) {
        throw { status: 400, message: "Parent recipient was not found" };
      }

      parentId = data.parentId;
    }

    const [parentUser, staffUser, child] = await Promise.all([
      prisma.user.findUnique({ where: { id: parentId } }),
      prisma.user.findUnique({ where: { id: staffId } }),
      childId
        ? prisma.child.findUnique({
            where: { id: childId },
            include: { parent: true },
          })
        : Promise.resolve(null),
    ]);

    if (!parentUser || parentUser.role !== "PARENT") {
      throw { status: 400, message: "Parent recipient was not found" };
    }

    if (!staffUser || staffUser.role !== "TEACHER") {
      throw { status: 400, message: "Staff recipient was not found" };
    }

    if (child && child.parentId !== parentId) {
      throw { status: 400, message: "Feedback child was not found" };
    }

    const thread = await prisma.feedbackThread.create({
      data: {
        subject,
        parentId,
        staffId,
        childId: child?.id || null,
        lastMessageAt: new Date(),
        messages: {
          create: {
            senderId: req.user.id,
            body: messageBody,
          },
        },
      },
      include: detailInclude,
    });

    const recipient = req.user.role === "PARENT" ? staffUser : parentUser;

    await createNotification({
      userId: recipient.id,
      title: "Новая обратная связь",
      message: `${req.user.fullName} открыл(а) тему «${subject}».`,
      type: "SYSTEM",
    });

    res.status(201).json({
      thread: serializeFeedbackThread(thread),
    });
  }),
);

router.post(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const data = createMessageSchema.parse(req.body);
    const baseThread = await loadThread(req.params.id, req.user, summaryInclude);

    const message = await prisma.feedbackMessage.create({
      data: {
        threadId: baseThread.id,
        senderId: req.user.id,
        body: data.body.trim(),
      },
      include: {
        sender: true,
      },
    });

    await prisma.feedbackThread.update({
      where: { id: baseThread.id },
      data: {
        lastMessageAt: message.createdAt,
      },
    });

    const thread = await loadThread(req.params.id, req.user, detailInclude);
    const recipientId =
      req.user.id === thread.parentId ? thread.staffId : thread.parentId;

    await createNotification({
      userId: recipientId,
      title: "Новый ответ по обратной связи",
      message: `${req.user.fullName} ответил(а) в теме «${thread.subject}».`,
      type: "SYSTEM",
    });

    res.status(201).json({
      message: serializeFeedbackMessage(message),
      thread: serializeFeedbackThread(thread),
    });
  }),
);

module.exports = router;
