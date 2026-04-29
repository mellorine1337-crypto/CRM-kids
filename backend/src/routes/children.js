const express = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");
const { serializeChild } = require("../utils/serializers");

const router = express.Router();

const childSchema = z.object({
  parentId: z.string().optional(),
  fullName: z.string().min(2).max(120),
  birthDate: z.coerce.date(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  medicalNotes: z.string().max(1000).optional().nullable(),
});

const childUpdateSchema = childSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field must be provided",
});

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const where =
      req.user.role === "PARENT" ? { parentId: req.user.id } : undefined;

    const children = await prisma.child.findMany({
      where,
      include: {
        parent: true,
        enrollments: {
          where: {
            status: {
              not: "CANCELLED",
            },
          },
          include: {
            lesson: true,
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
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      items: children.map(serializeChild),
    });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = childSchema.parse(req.body);
    const targetParentId =
      req.user.role === "PARENT" ? req.user.id : data.parentId;

    if (!targetParentId) {
      throw { status: 400, message: "parentId is required for staff" };
    }

    const parent = await prisma.user.findUnique({
      where: { id: targetParentId },
    });

    if (!parent || parent.role !== "PARENT") {
      throw { status: 400, message: "Parent account was not found" };
    }

    const child = await prisma.child.create({
      data: {
        parentId: targetParentId,
        fullName: data.fullName,
        birthDate: data.birthDate,
        gender: data.gender || null,
        medicalNotes: data.medicalNotes || null,
      },
      include: { parent: true },
    });

    res.status(201).json({
      child: serializeChild(child),
    });
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = childUpdateSchema.parse(req.body);
    const child = await prisma.child.findUnique({
      where: { id: req.params.id },
      include: { parent: true },
    });

    if (!child) {
      throw { status: 404, message: "Child not found" };
    }

    if (req.user.role === "PARENT" && child.parentId !== req.user.id) {
      throw { status: 403, message: "You can update only your own children" };
    }

    const updatedChild = await prisma.child.update({
      where: { id: child.id },
      data: {
        parentId:
          req.user.role === "PARENT" ? undefined : data.parentId || undefined,
        fullName: data.fullName,
        birthDate: data.birthDate,
        gender: data.gender,
        medicalNotes: data.medicalNotes,
      },
      include: { parent: true },
    });

    res.json({
      child: serializeChild(updatedChild),
    });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const child = await prisma.child.findUnique({
      where: { id: req.params.id },
    });

    if (!child) {
      throw { status: 404, message: "Child not found" };
    }

    if (req.user.role === "PARENT" && child.parentId !== req.user.id) {
      throw { status: 403, message: "You can delete only your own children" };
    }

    await prisma.child.delete({
      where: { id: child.id },
    });

    res.status(204).send();
  }),
);

module.exports = router;
