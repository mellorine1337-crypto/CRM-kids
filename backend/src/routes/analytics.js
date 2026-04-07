const express = require("express");
const { prisma } = require("../lib/prisma");
const { buildChildRecommendations } = require("../lib/recommendations");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");
const { serializeChild } = require("../utils/serializers");

const router = express.Router();

router.use(requireAuth);
router.use(requireRoles("STAFF"));

const getMonthStart = (year, month) => new Date(year, month, 1, 0, 0, 0, 0);

router.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = getMonthStart(now.getFullYear(), now.getMonth());
    const sixMonthsStart = getMonthStart(now.getFullYear(), now.getMonth() - 5);
    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 30);

    const [
      parentsCount,
      childrenCount,
      totalLessonsCount,
      upcomingLessons,
      enrollments,
      payments,
      attendanceRecords,
      recentParentsCount,
    ] = await Promise.all([
      prisma.user.count({
        where: { role: "PARENT" },
      }),
      prisma.child.count(),
      prisma.lesson.count(),
      prisma.lesson.findMany({
        where: {
          date: { gte: todayStart },
        },
        include: {
          enrollments: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 6,
      }),
      prisma.enrollment.findMany({
        include: {
          child: {
            include: {
              parent: true,
            },
          },
          lesson: {
            select: {
              id: true,
              title: true,
              date: true,
              startTime: true,
              capacity: true,
              teacherName: true,
            },
          },
          payments: {
            select: {
              status: true,
              amount: true,
              createdAt: true,
            },
          },
          attendance: {
            select: {
              status: true,
              markedAt: true,
            },
          },
          journal: {
            select: {
              score: true,
              progressLevel: true,
              homeworkStatus: true,
              teacherComment: true,
              parentComment: true,
              homeworkDueDate: true,
            },
          },
        },
      }),
      prisma.payment.findMany({
        where: {
          createdAt: { gte: sixMonthsStart },
        },
        include: {
          enrollment: {
            include: {
              lesson: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      }),
      prisma.attendance.findMany({
        include: {
          enrollment: {
            select: {
              lessonId: true,
            },
          },
        },
      }),
      prisma.user.count({
        where: {
          role: "PARENT",
          createdAt: { gte: last30Days },
        },
      }),
    ]);

    const activeEnrollments = enrollments.filter(
      (enrollment) => enrollment.status !== "CANCELLED",
    );
    const bookedEnrollments = enrollments.filter(
      (enrollment) => enrollment.status === "BOOKED",
    );
    const attendedEnrollments = enrollments.filter(
      (enrollment) => enrollment.status === "ATTENDED",
    );
    const missedEnrollments = enrollments.filter(
      (enrollment) => enrollment.status === "MISSED",
    );
    const unpaidEnrollments = activeEnrollments.filter(
      (enrollment) =>
        !enrollment.payments.some((payment) => payment.status === "SUCCEEDED"),
    );

    const presentAttendance = attendanceRecords.filter(
      (record) => record.status === "PRESENT",
    ).length;
    const absentAttendance = attendanceRecords.filter(
      (record) => record.status === "ABSENT",
    ).length;
    const totalAttendance = attendanceRecords.length;
    const attendanceRate = totalAttendance
      ? Math.round((presentAttendance / totalAttendance) * 100)
      : 0;

    const succeededPayments = payments.filter(
      (payment) => payment.status === "SUCCEEDED",
    );
    const pendingPayments = payments.filter(
      (payment) => payment.status === "PENDING",
    );
    const failedPayments = payments.filter(
      (payment) => payment.status === "FAILED",
    );
    const cancelledPayments = payments.filter(
      (payment) => payment.status === "CANCELLED",
    );

    const totalRevenue = succeededPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const monthRevenue = succeededPayments
      .filter((payment) => payment.createdAt >= monthStart)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const revenueByMonth = Array.from({ length: 6 }, (_, index) => {
      const cursor = getMonthStart(now.getFullYear(), now.getMonth() - (5 - index));
      const nextCursor = getMonthStart(cursor.getFullYear(), cursor.getMonth() + 1);
      const monthPayments = succeededPayments.filter(
        (payment) => payment.createdAt >= cursor && payment.createdAt < nextCursor,
      );

      return {
        key: `${cursor.getFullYear()}-${cursor.getMonth() + 1}`,
        label: cursor.toLocaleString("en-US", { month: "short" }),
        amount: monthPayments.reduce(
          (sum, payment) => sum + Number(payment.amount),
          0,
        ),
        paymentsCount: monthPayments.length,
      };
    });

    const lessonStatsMap = new Map();

    for (const enrollment of activeEnrollments) {
      const lesson = enrollment.lesson;

      if (!lesson) {
        continue;
      }

      const existing = lessonStatsMap.get(lesson.id) || {
        id: lesson.id,
        title: lesson.title,
        date: lesson.date,
        startTime: lesson.startTime,
        capacity: lesson.capacity,
        teacherName: lesson.teacherName,
        bookedCount: 0,
      };

      existing.bookedCount += 1;
      lessonStatsMap.set(lesson.id, existing);
    }

    const popularLessons = Array.from(lessonStatsMap.values())
      .map((lesson) => ({
        ...lesson,
        occupancyRate: lesson.capacity
          ? Math.round((lesson.bookedCount / lesson.capacity) * 100)
          : 0,
      }))
      .sort((left, right) => right.bookedCount - left.bookedCount)
      .slice(0, 5);

    const upcomingLoad = upcomingLessons.map((lesson) => {
      const bookedCount = lesson.enrollments.filter(
        (enrollment) => enrollment.status !== "CANCELLED",
      ).length;

      return {
        id: lesson.id,
        title: lesson.title,
        date: lesson.date,
        startTime: lesson.startTime,
        teacherName: lesson.teacherName,
        capacity: lesson.capacity,
        bookedCount,
        availableSpots: Math.max(lesson.capacity - bookedCount, 0),
        occupancyRate: lesson.capacity
          ? Math.round((bookedCount / lesson.capacity) * 100)
          : 0,
      };
    });

    const bookedLast30Days = enrollments.filter(
      (enrollment) => enrollment.createdAt >= last30Days,
    ).length;
    const paidLast30Days = succeededPayments.filter(
      (payment) => payment.createdAt >= last30Days,
    ).length;
    const attendedLast30Days = attendanceRecords.filter(
      (record) => record.status === "PRESENT" && record.markedAt >= last30Days,
    ).length;

    const averageOccupancy = upcomingLoad.length
      ? Math.round(
          upcomingLoad.reduce((sum, lesson) => sum + lesson.occupancyRate, 0) /
            upcomingLoad.length,
        )
      : 0;

    const teacherStatsMap = new Map();

    for (const enrollment of activeEnrollments) {
      const lesson = enrollment.lesson;

      if (!lesson) {
        continue;
      }

      const teacherName = lesson.teacherName || "Без имени";
      const stats = teacherStatsMap.get(teacherName) || {
        teacherName,
        lessonIds: new Set(),
        childIds: new Set(),
        attendancePresent: 0,
        attendanceTotal: 0,
        scoreTotal: 0,
        scoreCount: 0,
        revenue: 0,
        paidEnrollmentsCount: 0,
        riskSignals: 0,
      };

      stats.lessonIds.add(lesson.id);
      stats.childIds.add(enrollment.childId);

      if (enrollment.attendance) {
        stats.attendanceTotal += 1;

        if (enrollment.attendance.status === "PRESENT") {
          stats.attendancePresent += 1;
        }
      }

      if (typeof enrollment.journal?.score === "number") {
        stats.scoreTotal += enrollment.journal.score;
        stats.scoreCount += 1;
      }

      const successfulPayments = enrollment.payments.filter(
        (payment) => payment.status === "SUCCEEDED",
      );

      if (successfulPayments.length) {
        stats.paidEnrollmentsCount += 1;
        stats.revenue += successfulPayments.reduce(
          (sum, payment) => sum + Number(payment.amount),
          0,
        );
      }

      if (
        enrollment.status === "MISSED" ||
        enrollment.journal?.progressLevel === "ATTENTION_REQUIRED" ||
        enrollment.journal?.homeworkStatus === "OVERDUE"
      ) {
        stats.riskSignals += 1;
      }

      teacherStatsMap.set(teacherName, stats);
    }

    const teacherPerformance = Array.from(teacherStatsMap.values())
      .map((stats) => {
        const teacherAttendanceRate = stats.attendanceTotal
          ? Math.round((stats.attendancePresent / stats.attendanceTotal) * 100)
          : 0;
        const averageScore = stats.scoreCount
          ? Math.round(stats.scoreTotal / stats.scoreCount)
          : 0;
        const paymentDiscipline = stats.childIds.size
          ? Math.round((stats.paidEnrollmentsCount / stats.childIds.size) * 100)
          : 100;
        const effectivenessScore = Math.round(
          teacherAttendanceRate * 0.45 + averageScore * 0.4 + paymentDiscipline * 0.15,
        );

        return {
          teacherName: stats.teacherName,
          lessonsCount: stats.lessonIds.size,
          studentsCount: stats.childIds.size,
          attendanceRate: teacherAttendanceRate,
          averageScore,
          revenue: stats.revenue,
          effectivenessScore,
          riskSignals: stats.riskSignals,
        };
      })
      .sort((left, right) => right.effectivenessScore - left.effectivenessScore)
      .slice(0, 6);

    const childrenMap = new Map();

    for (const enrollment of enrollments) {
      if (!enrollment.child) {
        continue;
      }

      const bucket = childrenMap.get(enrollment.child.id) || {
        child: enrollment.child,
        enrollments: [],
      };

      bucket.enrollments.push(enrollment);
      childrenMap.set(enrollment.child.id, bucket);
    }

    const childInsights = Array.from(childrenMap.values()).map((bucket) =>
      buildChildRecommendations({
        child: serializeChild(bucket.child),
        enrollments: bucket.enrollments,
      }),
    );

    const recommendationInsights = childInsights.reduce(
      (accumulator, item) => {
        accumulator.totalChildren += 1;
        accumulator[`${item.riskLevel.toLowerCase()}RiskCount`] += 1;

        if (item.recommendations.some((recommendation) => recommendation.priority === "high")) {
          accumulator.highPriorityChildren += 1;
        }

        return accumulator;
      },
      {
        totalChildren: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        highPriorityChildren: 0,
      },
    );

    const churnRisk = childInsights
      .filter(
        (item) =>
          item.riskLevel !== "LOW" ||
          item.recommendations.some((recommendation) => recommendation.priority === "high"),
      )
      .sort((left, right) => right.riskScore - left.riskScore)
      .slice(0, 6)
      .map((item) => ({
        childId: item.child.id,
        childName: item.child.fullName,
        parentName: item.child.parent?.fullName,
        riskLevel: item.riskLevel,
        riskScore: item.riskScore,
        attendanceRate: item.metrics.attendanceRate,
        averageScore: item.metrics.averageScore,
        missedCount: item.metrics.missedCount,
        overdueHomeworkCount: item.metrics.overdueHomeworkCount,
        unpaidCount: item.metrics.unpaidCount,
        primaryRecommendation: item.recommendations[0],
      }));

    res.json({
      overview: {
        parentsCount,
        childrenCount,
        totalLessonsCount,
        upcomingLessonsCount: upcomingLoad.length,
        activeEnrollmentsCount: activeEnrollments.length,
        bookedEnrollmentsCount: bookedEnrollments.length,
        monthRevenue,
        totalRevenue,
        attendanceRate,
        unpaidEnrollmentsCount: unpaidEnrollments.length,
        missedEnrollmentsCount: missedEnrollments.length,
        averageOccupancy,
      },
      funnel: {
        leads: recentParentsCount,
        booked: bookedLast30Days,
        paid: paidLast30Days,
        attended: attendedLast30Days,
      },
      attendance: {
        presentCount: presentAttendance,
        absentCount: absentAttendance,
        attendedEnrollmentsCount: attendedEnrollments.length,
        missedEnrollmentsCount: missedEnrollments.length,
        rate: attendanceRate,
      },
      payments: {
        pendingCount: pendingPayments.length,
        succeededCount: succeededPayments.length,
        failedCount: failedPayments.length,
        cancelledCount: cancelledPayments.length,
        monthRevenue,
        totalRevenue,
      },
      revenueByMonth,
      popularLessons,
      upcomingLoad,
      teacherPerformance,
      churnRisk,
      recommendationInsights,
      risk: {
        unpaidEnrollmentsCount: unpaidEnrollments.length,
        missedEnrollmentsCount: missedEnrollments.length,
        pendingPaymentsCount: pendingPayments.length,
      },
      generatedAt: now.toISOString(),
    });
  }),
);

module.exports = router;
