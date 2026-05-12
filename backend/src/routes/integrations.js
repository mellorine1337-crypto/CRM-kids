// Кратко: отдаёт справочник интеграций и их статусы для административного блока.
const express = require("express");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");
const { serializeIntegrationConnection } = require("../utils/serializers");

const router = express.Router();

const integrationSchema = z.object({
  type: z.enum(["SCHOOL_SYSTEM", "EDUCATION_PLATFORM", "SUBSIDY_PROGRAM"]),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(["PLANNED", "ACTIVE", "PAUSED", "ERROR"]).optional(),
  endpoint: z.string().trim().url().optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const integrationUpdateSchema = integrationSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

// REST-маршрут USE ADMIN: обрабатывает запросы этого модуля.
router.use(requireAuth);
// REST-маршрут USE /: обрабатывает запросы этого модуля.
router.use(requireRoles("ADMIN"));

// REST-маршрут GET /: обрабатывает запросы этого модуля.
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await prisma.integrationConnection.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    res.json({
      items: items.map(serializeIntegrationConnection),
    });
  }),
);

// REST-маршрут POST /: обрабатывает запросы этого модуля.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = integrationSchema.parse(req.body);
    const integration = await prisma.integrationConnection.create({
      data: {
        type: data.type,
        name: data.name,
        description: data.description || null,
        status: data.status || "PLANNED",
        endpoint: data.endpoint || null,
        notes: data.notes || null,
      },
    });

    res.status(201).json({
      integration: serializeIntegrationConnection(integration),
    });
  }),
);

// REST-маршрут PATCH /:id: обрабатывает запросы этого модуля.
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = integrationUpdateSchema.parse(req.body);
    const existing = await prisma.integrationConnection.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      throw { status: 404, message: "Integration connection not found" };
    }

    const integration = await prisma.integrationConnection.update({
      where: { id: existing.id },
      data: {
        type: data.type,
        name: data.name,
        description: data.description === "" ? null : data.description,
        status: data.status,
        endpoint: data.endpoint === "" ? null : data.endpoint,
        notes: data.notes === "" ? null : data.notes,
      },
    });

    res.json({
      integration: serializeIntegrationConnection(integration),
    });
  }),
);

// REST-маршрут POST /:id/sync: обрабатывает запросы этого модуля.
router.post(
  "/:id/sync",
  asyncHandler(async (req, res) => {
    const existing = await prisma.integrationConnection.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      throw { status: 404, message: "Integration connection not found" };
    }

    const integration = await prisma.integrationConnection.update({
      where: { id: existing.id },
      data: {
        status: existing.status === "ERROR" ? "PAUSED" : "ACTIVE",
        lastSyncAt: new Date(),
      },
    });

    res.json({
      integration: serializeIntegrationConnection(integration),
    });
  }),
);

module.exports = router;
