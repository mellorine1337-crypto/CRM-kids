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

const registrationSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must contain at least 8 characters").max(128),
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

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const data = registrationSchema.parse(req.body);
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw { status: 409, message: "User with this email already exists" };
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email.toLowerCase(),
        phone: data.phone,
        passwordHash,
        role: "PARENT",
      },
    });

    const tokens = buildTokenPair(user);
    await persistRefreshToken(user.id, tokens.refreshToken);

    res.status(201).json({
      user: serializeUser(user),
      tokens,
    });
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (!user) {
      throw { status: 401, message: "Invalid email or password" };
    }

    const matches = await bcrypt.compare(data.password, user.passwordHash);

    if (!matches) {
      throw { status: 401, message: "Invalid email or password" };
    }

    const tokens = buildTokenPair(user);
    await persistRefreshToken(user.id, tokens.refreshToken);

    res.json({
      user: serializeUser(user),
      tokens,
    });
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
