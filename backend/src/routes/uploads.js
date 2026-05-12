// Кратко: приём и сохранение файлов, связанных с детьми.
const express = require("express");
const { prisma } = require("../lib/prisma");
const { upload } = require("../lib/upload");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");
const { serializeChild } = require("../utils/serializers");

const router = express.Router();

// REST-маршрут USE /children/:childId/avatar: обрабатывает запросы этого модуля.
router.use(requireAuth);

// REST-маршрут POST /children/:childId/avatar: обрабатывает запросы этого модуля.
router.post(
  "/children/:childId/avatar",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw { status: 400, message: "File is required" };
    }

    const child = await prisma.child.findUnique({
      where: { id: req.params.childId },
      include: { parent: true },
    });

    if (!child) {
      throw { status: 404, message: "Child not found" };
    }

    if (req.user.role === "PARENT" && child.parentId !== req.user.id) {
      throw {
        status: 403,
        message: "You can upload files only for your own children",
      };
    }

    const updatedChild = await prisma.child.update({
      where: { id: child.id },
      data: {
        profileImageUrl: `/uploads/children/${req.file.filename}`,
      },
      include: { parent: true },
    });

    res.status(201).json({
      child: serializeChild(updatedChild),
    });
  }),
);

module.exports = router;
