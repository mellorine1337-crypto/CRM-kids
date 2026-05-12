// Кратко: профиль текущего пользователя, списки родителей/преподавателей и создание преподавателей админом.
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
  phoneSchema,
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

const createTeacherSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

// REST-маршрут USE: обрабатывает запросы этого модуля.
router.use(requireAuth);

// Служебная функция ensureUniqueUserFields: инкапсулирует отдельный шаг логики этого модуля.
const ensureUniqueUserFields = async ({ email, phone, excludeUserId }) => {
  const [existingEmailUser, existingPhoneUser] = await Promise.all([
    email
      ? prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        })
      : null,
    phone
      ? prisma.user.findFirst({
          where: { phone },
        })
      : null,
  ]);

  if (existingEmailUser && existingEmailUser.id !== excludeUserId) {
    throw { status: 409, message: "Email is already in use" };
  }

  if (existingPhoneUser && existingPhoneUser.id !== excludeUserId) {
    throw { status: 409, message: "Phone is already in use" };
  }
};

// REST-маршрут GET /me: обрабатывает запросы этого модуля.
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    res.json({
      user: serializeUser(req.user),
    });
  }),
);

// REST-маршрут GET /parents: обрабатывает запросы этого модуля.
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

// REST-маршрут GET /teachers: обрабатывает запросы этого модуля.
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

// REST-маршрут POST /teachers: обрабатывает запросы этого модуля.
router.post(
  "/teachers",
  requireRoles("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = createTeacherSchema.parse(req.body);

    await ensureUniqueUserFields({
      email: data.email,
      phone: data.phone,
    });

    const teacher = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email.toLowerCase(),
        phone: data.phone,
        passwordHash: await bcrypt.hash(data.password, 10),
        role: "TEACHER",
      },
    });

    res.status(201).json({
      user: serializeUser(teacher),
    });
  }),
);

// REST-маршрут PATCH /me: обрабатывает запросы этого модуля.
router.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const data = updateProfileSchema.parse(req.body);

    await ensureUniqueUserFields({
      email: data.email,
      phone: data.phone,
      excludeUserId: req.user.id,
    });

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
