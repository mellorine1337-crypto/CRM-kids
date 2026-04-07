const express = require("express");
const { prisma } = require("../lib/prisma");
const { buildChildRecommendations } = require("../lib/recommendations");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");
const { serializeChild } = require("../utils/serializers");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const children = await prisma.child.findMany({
      where: req.user.role === "PARENT" ? { parentId: req.user.id } : undefined,
      include: {
        parent: true,
        enrollments: {
          include: {
            lesson: true,
            attendance: true,
            journal: true,
            payments: {
              orderBy: {
                createdAt: "desc",
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        fullName: "asc",
      },
    });

    const items = children.map((child) =>
      buildChildRecommendations({
        child: serializeChild(child),
        enrollments: child.enrollments,
      }),
    );

    const summary = items.reduce(
      (accumulator, item) => {
        accumulator.totalChildren += 1;
        accumulator.totalRecommendations += item.recommendations.length;
        accumulator[`${item.riskLevel.toLowerCase()}RiskCount`] += 1;

        if (item.recommendations.some((recommendation) => recommendation.priority === "high")) {
          accumulator.highPriorityChildren += 1;
        }

        return accumulator;
      },
      {
        totalChildren: 0,
        totalRecommendations: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        highPriorityChildren: 0,
      },
    );

    res.json({
      items,
      summary,
      generatedAt: new Date().toISOString(),
    });
  }),
);

module.exports = router;
