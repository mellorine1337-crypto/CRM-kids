// Кратко: отдаёт административную аналитику по выручке, посещаемости и загрузке центра.
const express = require("express");
const { prisma } = require("../lib/prisma");
const { buildEnrollmentFinancials } = require("../lib/finance");
const { buildChildRecommendations } = require("../lib/recommendations");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");
const { serializeChild } = require("../utils/serializers");

const router = express.Router();

// REST-маршрут USE ADMIN: обрабатывает запросы этого модуля.
router.use(requireAuth);
// REST-маршрут USE: обрабатывает запросы этого модуля.
router.use(requireRoles("ADMIN"));

// Функция getMonthStart: возвращает значение или подготовленные данные по входным параметрам.
const getMonthStart = (year, month) => new Date(year, month, 1, 0, 0, 0, 0);

// REST-маршрут GET /overview: обрабатывает запросы этого модуля.
router.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = getMonthStart(now.getFullYear(), now.getMonth());
    const sixMonthsStart = getMonthStart(now.getFullYear(), now.getMonth() - 5);
    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 30);

    const [
      parentsCount,
      childrenCount,
      totalLessonsCount,
      todayLessonsCount,
      upcomingLessons,
      enrollments,
      payments,
      attendanceRecords,
      recentParentsCount,
      staffUsers,
    ] = await Promise.all([
      prisma.user.count({
        where: { role: "PARENT" },
      }),
      prisma.child.count(),
      prisma.lesson.count(),
      prisma.lesson.count({
        where: {
          date: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),
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
              paidAt: true,
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
          recordedBy: true,
          enrollment: {
            include: {
              lesson: {
                select: {
                  id: true,
                  title: true,
                },
              },
              child: {
                select: {
                  id: true,
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
      prisma.user.findMany({
        where: {
          role: "TEACHER",
        },
        select: {
          id: true,
          fullName: true,
        },
      }),
    ]);

    const activeEnrollments = enrollments.filter(
      (enrollment) => enrollment.status !== "CANCELLED",
    );
    const activeStudentsCount = new Set(
      activeEnrollments.map((enrollment) => enrollment.childId),
    ).size;
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
      (enrollment) => buildEnrollmentFinancials(enrollment).debt > 0,
    );
    const totalDebt = activeEnrollments.reduce(
      (sum, enrollment) => sum + buildEnrollmentFinancials(enrollment).debt,
      0,
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
    const partialPayments = payments.filter(
      (payment) => payment.status === "PARTIAL",
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

    const settledPayments = payments.filter((payment) =>
      ["SUCCEEDED", "PARTIAL"].includes(payment.status),
    );

    const totalRevenue = settledPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const monthRevenue = settledPayments
      .filter((payment) => (payment.paidAt || payment.createdAt) >= monthStart)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const todayRevenue = settledPayments
      .filter((payment) => {
        const paymentDate = payment.paidAt || payment.createdAt;
        return paymentDate >= todayStart && paymentDate <= todayEnd;
      })
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const revenueByMonth = Array.from({ length: 6 }, (_, index) => {
      const cursor = getMonthStart(now.getFullYear(), now.getMonth() - (5 - index));
      const nextCursor = getMonthStart(cursor.getFullYear(), cursor.getMonth() + 1);
      const monthPayments = settledPayments.filter((payment) => {
        const paymentDate = payment.paidAt || payment.createdAt;
        return paymentDate >= cursor && paymentDate < nextCursor;
      });

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

    const todayEnrollments = activeEnrollments.filter((enrollment) => {
      const lessonDate = new Date(enrollment.lesson?.date);
      return lessonDate >= todayStart && lessonDate <= todayEnd;
    });

    const attendanceToday = todayEnrollments.reduce(
      (summary, enrollment) => {
        if (
          enrollment.attendance?.status === "PRESENT" ||
          enrollment.status === "ATTENDED"
        ) {
          summary.present += 1;
        } else if (
          enrollment.attendance?.status === "ABSENT" ||
          enrollment.status === "MISSED"
        ) {
          summary.absent += 1;
        } else {
          summary.expected += 1;
        }

        return summary;
      },
      {
        present: 0,
        expected: 0,
        absent: 0,
      },
    );

    const bestStaffMonthMap = new Map(
      staffUsers.map((staff) => [
        staff.id,
        {
          id: staff.id,
          fullName: staff.fullName,
          revenue: 0,
          childIds: new Set(),
        },
      ]),
    );

    for (const payment of settledPayments) {
      const paymentDate = payment.paidAt || payment.createdAt;

      if (
        !payment.recordedById ||
        paymentDate < monthStart ||
        !bestStaffMonthMap.has(payment.recordedById)
      ) {
        continue;
      }

      const staff = bestStaffMonthMap.get(payment.recordedById);
      staff.revenue += Number(payment.amount);

      if (payment.enrollment?.child?.id) {
        staff.childIds.add(payment.enrollment.child.id);
      }
    }

    const bestStaffMonth =
      Array.from(bestStaffMonthMap.values())
        .map((staff) => ({
          id: staff.id,
          fullName: staff.fullName,
          revenue: staff.revenue,
          activeStudentsCount: staff.childIds.size,
        }))
        .sort((left, right) => {
          if (right.revenue !== left.revenue) {
            return right.revenue - left.revenue;
          }

          return right.activeStudentsCount - left.activeStudentsCount;
        })[0] || null;

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
    const paidLast30Days = settledPayments.filter(
      (payment) => (payment.paidAt || payment.createdAt) >= last30Days,
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

      const successfulPayments = enrollment.payments.filter((payment) =>
        ["SUCCEEDED", "PARTIAL"].includes(payment.status),
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
        todayLessonsCount,
        upcomingLessonsCount: upcomingLoad.length,
        activeEnrollmentsCount: activeEnrollments.length,
        activeStudentsCount,
        bookedEnrollmentsCount: bookedEnrollments.length,
        todayRevenue,
        monthRevenue,
        totalRevenue,
        totalDebt,
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
      attendanceToday,
      payments: {
        pendingCount: pendingPayments.length,
        partialCount: partialPayments.length,
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
      bestStaffMonth,
      generatedAt: now.toISOString(),
    });
  }),
);

module.exports = router;
