const crypto = require("node:crypto");
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
  password: z.string().min(8, "Password must contain at least 8 characters").max(128),
});

const parentCodeRequestSchema = z.object({
  fullName: fullNameSchema.optional(),
  phone: phoneSchema,
});

const verifyCodeSchema = z.object({
  phone: phoneSchema,
  code: z.string().trim().length(6),
  fullName: fullNameSchema.optional(),
});

const teacherMagicLinkRequestSchema = z.object({
  phone: phoneSchema,
});

const teacherMagicLinkVerifySchema = z.object({
  token: z.string().min(12),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const buildParentEmail = (phone) =>
  `parent-${String(phone).replace(/\D/g, "")}@parents.crm.local`;

const buildTeacherFallbackPassword = () =>
  `Teacher-${crypto.randomBytes(12).toString("hex")}`;

const createAuthCode = async ({ userId, phone, purpose }) => {
  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.authCode.create({
    data: {
      userId,
      phone,
      purpose,
      codeHash,
      expiresAt,
    },
  });

  return {
    code,
    expiresAt,
  };
};

const createMagicLink = async ({ userId }) => {
  const rawToken = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.magicLinkToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt,
    },
  });

  return {
    token: rawToken,
    expiresAt,
    url: `${env.frontendUrl}/login?teacherMagicToken=${rawToken}`,
  };
};

const issueSession = async (user) => {
  const tokens = buildTokenPair(user);
  await persistRefreshToken(user.id, tokens.refreshToken);
  return {
    user: serializeUser(user),
    tokens,
  };
};

// Refresh token хранится только в виде SHA-256 hash, поэтому в базе нет исходных переиспользуемых токенов.
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
  "/admin/login",
  asyncHandler(async (req, res) => {
    const data = adminLoginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (!user || user.role !== "ADMIN") {
      throw { status: 401, message: "Invalid email or password" };
    }

    const matches = await bcrypt.compare(data.password, user.passwordHash);

    if (!matches) {
      throw { status: 401, message: "Invalid email or password" };
    }

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

    const matches = await bcrypt.compare(data.password, user.passwordHash);

    if (!matches) {
      throw { status: 401, message: "Invalid email or password" };
    }

    res.json(await issueSession(user));
  }),
);

router.post(
  "/parent/code/request",
  asyncHandler(async (req, res) => {
    const data = parentCodeRequestSchema.parse(req.body);
    let user = await prisma.user.findFirst({
      where: {
        phone: data.phone,
      },
    });

    if (user && user.role !== "PARENT") {
      throw { status: 403, message: "Insufficient permissions" };
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          fullName: data.fullName || `Родитель ${data.phone.slice(-4)}`,
          email: buildParentEmail(data.phone),
          phone: data.phone,
          passwordHash: await bcrypt.hash(buildTeacherFallbackPassword(), 10),
          role: "PARENT",
        },
      });
    }

    const challenge = await createAuthCode({
      userId: user.id,
      phone: data.phone,
      purpose: "PARENT_LOGIN",
    });

    res.json({
      ok: true,
      ...(env.nodeEnv !== "production" ? { devCode: challenge.code } : {}),
    });
  }),
);

router.post(
  "/parent/code/verify",
  asyncHandler(async (req, res) => {
    const data = verifyCodeSchema.parse(req.body);
    const codeRecord = await prisma.authCode.findFirst({
      where: {
        phone: data.phone,
        purpose: "PARENT_LOGIN",
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!codeRecord || !codeRecord.user) {
      throw { status: 401, message: "Invalid or expired refresh token" };
    }

    const matches = await bcrypt.compare(data.code, codeRecord.codeHash);

    if (!matches) {
      throw { status: 401, message: "Invalid email or password" };
    }

    if (!codeRecord.user.fullName && data.fullName) {
      await prisma.user.update({
        where: { id: codeRecord.user.id },
        data: { fullName: data.fullName },
      });
    }

    await prisma.authCode.update({
      where: { id: codeRecord.id },
      data: { usedAt: new Date() },
    });

    const user = await prisma.user.findUnique({
      where: { id: codeRecord.user.id },
    });

    res.json(await issueSession(user));
  }),
);

router.post(
  "/teacher/magic-link/request",
  asyncHandler(async (req, res) => {
    const data = teacherMagicLinkRequestSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: {
        phone: data.phone,
        role: "TEACHER",
      },
    });

    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    const link = await createMagicLink({
      userId: user.id,
    });

    res.json({
      ok: true,
      expiresAt: link.expiresAt,
      ...(env.nodeEnv !== "production"
        ? {
            magicLink: link.url,
            magicToken: link.token,
          }
        : {}),
    });
  }),
);

router.post(
  "/teacher/magic-link/verify",
  asyncHandler(async (req, res) => {
    const data = teacherMagicLinkVerifySchema.parse(req.body);
    const link = await prisma.magicLinkToken.findUnique({
      where: {
        tokenHash: hashToken(data.token),
      },
      include: {
        user: true,
      },
    });

    if (!link || link.usedAt || link.expiresAt < new Date() || !link.user) {
      throw { status: 401, message: "Invalid or expired refresh token" };
    }

    await prisma.magicLinkToken.update({
      where: { id: link.id },
      data: {
        usedAt: new Date(),
      },
    });

    res.json(await issueSession(link.user));
  }),
);

router.post(
  "/teacher/code/request",
  asyncHandler(async (req, res) => {
    const data = parentCodeRequestSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: {
        phone: data.phone,
        role: "TEACHER",
      },
    });

    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    const challenge = await createAuthCode({
      userId: user.id,
      phone: data.phone,
      purpose: "TEACHER_LOGIN",
    });

    res.json({
      ok: true,
      ...(env.nodeEnv !== "production" ? { devCode: challenge.code } : {}),
    });
  }),
);

router.post(
  "/teacher/code/verify",
  asyncHandler(async (req, res) => {
    const data = verifyCodeSchema.parse(req.body);
    const codeRecord = await prisma.authCode.findFirst({
      where: {
        phone: data.phone,
        purpose: "TEACHER_LOGIN",
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!codeRecord || !codeRecord.user || codeRecord.user.role !== "TEACHER") {
      throw { status: 401, message: "Invalid or expired refresh token" };
    }

    const matches = await bcrypt.compare(data.code, codeRecord.codeHash);

    if (!matches) {
      throw { status: 401, message: "Invalid email or password" };
    }

    await prisma.authCode.update({
      where: { id: codeRecord.id },
      data: { usedAt: new Date() },
    });

    res.json(await issueSession(codeRecord.user));
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

    // При каждом успешном refresh предыдущий refresh token инвалидируется и заменяется новым.
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
