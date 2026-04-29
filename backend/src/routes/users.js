const bcrypt = require("bcryptjs");
const express = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");
const { serializeUser } = require("../utils/serializers");
const {
  emailSchema,
  fullNameSchema,
  optionalPhoneSchema,
  passwordSchema,
} = require("../utils/validation");
const { requireRoles } = require("../middleware/auth");

const router = express.Router();

const updateProfileSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    email: emailSchema.optional(),
    phone: optionalPhoneSchema,
    newPassword: passwordSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

router.use(requireAuth);

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    res.json({
      user: serializeUser(req.user),
    });
  }),
);

router.get(
  "/parents",
  requireRoles("ADMIN"),
  asyncHandler(async (_req, res) => {
    const parents = await prisma.user.findMany({
      where: {
        role: "PARENT",
      },
      orderBy: { fullName: "asc" },
    });

    res.json({
      items: parents.map(serializeUser),
    });
  }),
);

router.get(
  "/teachers",
  requireRoles("ADMIN"),
  asyncHandler(async (_req, res) => {
    const teachers = await prisma.user.findMany({
      where: {
        role: "TEACHER",
      },
      orderBy: { fullName: "asc" },
    });

    res.json({
      items: teachers.map(serializeUser),
    });
  }),
);

router.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const data = updateProfileSchema.parse(req.body);

    if (data.email && data.email.toLowerCase() !== req.user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });

      if (existingUser) {
        throw { status: 409, message: "Email is already in use" };
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        fullName: data.fullName,
        email: data.email?.toLowerCase(),
        phone: data.phone,
        passwordHash: data.newPassword
          ? await bcrypt.hash(data.newPassword, 10)
          : undefined,
      },
    });

    res.json({
      user: serializeUser(updatedUser),
    });
  }),
);

module.exports = router;
