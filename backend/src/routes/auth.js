const bcrypt = require("bcryptjs");
const express = require("express");
const { z } = require("zod");
const { env } = require("../config/env");
const { prisma } = require("../lib/prisma");
const {
  buildTokenPair,
  hashToken,
  verifyRefreshToken,
} = require("../lib/tokens");
const { asyncHandler } = require("../utils/async-handler");
const { serializeUser } = require("../utils/serializers");
const {
  emailSchema,
  fullNameSchema,
  passwordSchema,
  phoneSchema,
} = require("../utils/validation");

const router = express.Router();

const adminLoginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const parentRegisterSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

const phoneLoginSchema = z.object({
  phone: phoneSchema,
  password: passwordSchema,
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const persistRefreshToken = async (userId, refreshToken) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.jwt.refreshTtlDays);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    },
  });
};

const issueSession = async (user) => {
  const tokens = buildTokenPair(user);
  await persistRefreshToken(user.id, tokens.refreshToken);

  return {
    user: serializeUser(user),
    tokens,
  };
};

const ensureEmailAndPhoneAreFree = async ({ email, phone }) => {
  const [existingEmailUser, existingPhoneUser] = await Promise.all([
    prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    }),
    prisma.user.findFirst({
      where: { phone },
    }),
  ]);

  if (existingEmailUser) {
    throw { status: 409, message: "Email is already in use" };
  }

  if (existingPhoneUser) {
    throw { status: 409, message: "Phone is already in use" };
  }
};

const verifyPasswordOrThrow = async ({ user, password, message }) => {
  if (!user) {
    throw { status: 401, message };
  }

  const matches = await bcrypt.compare(password, user.passwordHash);

  if (!matches) {
    throw { status: 401, message };
  }
};

router.post(
  "/admin/login",
  asyncHandler(async (req, res) => {
    const data = adminLoginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (!user || user.role !== "ADMIN") {
      throw { status: 401, message: "Invalid email or password" };
    }

    await verifyPasswordOrThrow({
      user,
      password: data.password,
      message: "Invalid email or password",
    });

    res.json(await issueSession(user));
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = adminLoginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (!user || user.role !== "ADMIN") {
      throw { status: 401, message: "Invalid email or password" };
    }

    await verifyPasswordOrThrow({
      user,
      password: data.password,
      message: "Invalid email or password",
    });

    res.json(await issueSession(user));
  }),
);

router.post(
  "/parent/register",
  asyncHandler(async (req, res) => {
    const data = parentRegisterSchema.parse(req.body);

    await ensureEmailAndPhoneAreFree({
      email: data.email,
      phone: data.phone,
    });

    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email.toLowerCase(),
        phone: data.phone,
        passwordHash: await bcrypt.hash(data.password, 10),
        role: "PARENT",
      },
    });

    res.status(201).json(await issueSession(user));
  }),
);

router.post(
  "/parent/login",
  asyncHandler(async (req, res) => {
    const data = phoneLoginSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: {
        phone: data.phone,
        role: "PARENT",
      },
    });

    await verifyPasswordOrThrow({
      user,
      password: data.password,
      message: "Invalid phone or password",
    });

    res.json(await issueSession(user));
  }),
);

router.post(
  "/teacher/login",
  asyncHandler(async (req, res) => {
    const data = phoneLoginSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: {
        phone: data.phone,
        role: "TEACHER",
      },
    });

    await verifyPasswordOrThrow({
      user,
      password: data.password,
      message: "Invalid phone or password",
    });

    res.json(await issueSession(user));
  }),
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    let payload;

    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (_error) {
      throw { status: 401, message: "Invalid or expired refresh token" };
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw { status: 401, message: "Refresh token is no longer valid" };
    }

    const user = storedToken.user;

    if (!user || user.id !== payload.sub) {
      throw { status: 401, message: "Refresh token does not match user" };
    }

    const tokens = buildTokenPair(user);

    await prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });
    await persistRefreshToken(user.id, tokens.refreshToken);

    res.json({
      user: serializeUser(user),
      tokens,
    });
  }),
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);

    await prisma.refreshToken.deleteMany({
      where: { tokenHash: hashToken(refreshToken) },
    });

    res.status(204).send();
  }),
);

module.exports = router;
