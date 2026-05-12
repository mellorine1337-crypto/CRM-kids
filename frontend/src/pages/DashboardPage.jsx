// Кратко: главная страница, которая показывает разный dashboard для разных ролей.
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  MessageSquareMore,
  MoveRight,
  PlusSquare,
  QrCode,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { StatCard } from "../components/StatCard.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import { formatCurrency, formatDate, formatPercent } from "../utils/format.js";
import { resolveNotificationPriority } from "../utils/notifications.js";
import {
  compareLessonDateTime,
  isFutureOrTodayLesson,
  isTodayLesson,
} from "../utils/schedule.js";

// React-компонент DashboardPage: собирает экран и связывает его с состоянием и API.
export function DashboardPage() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState({
    children: [],
    lessons: [],
    enrollments: [],
    payments: [],
    notifications: [],
    recommendations: [],
  });
  const [analytics, setAnalytics] = useState({
    overview: {
      todayRevenue: 0,
      activeStudentsCount: 0,
      todayLessonsCount: 0,
      totalDebt: 0,
    },
    attendanceToday: {
      present: 0,
      expected: 0,
      absent: 0,
    },
    bestStaffMonth: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Функция fetchDashboard: загружает данные и обновляет состояние.
    const fetchDashboard = async () => {
      try {
        // У каждой роли свой источник данных:
        // родитель видит только своих детей и финансы,
        // преподаватель — занятия и записи,
        // админ — ещё и управленческую аналитику.
        if (user.role === "PARENT") {
          const [
            childrenResponse,
            enrollmentsResponse,
            paymentsResponse,
            notificationsResponse,
            recommendationsResponse,
          ] = await Promise.all([
            api.get("/children"),
            api.get("/enrollments/my"),
            api.get("/payments/my"),
            api.get("/notifications"),
            api.get("/recommendations"),
          ]);

          setData({
            children: childrenResponse.data.items,
            lessons: [],
            enrollments: enrollmentsResponse.data.items,
            payments: paymentsResponse.data.items,
            notifications: notificationsResponse.data.items,
            recommendations: recommendationsResponse.data.items,
          });
          setAnalytics({
            overview: {
              todayRevenue: 0,
              activeStudentsCount: 0,
              todayLessonsCount: 0,
              totalDebt: 0,
            },
            attendanceToday: {
              present: 0,
              expected: 0,
              absent: 0,
            },
            bestStaffMonth: null,
          });
          return;
        }

        if (user.role === "TEACHER") {
          const [lessonsResponse, enrollmentsResponse, notificationsResponse] =
            await Promise.all([
              api.get("/lessons"),
              api.get("/enrollments"),
              api.get("/notifications"),
            ]);

          setData({
            children: [],
            lessons: lessonsResponse.data.items,
            enrollments: enrollmentsResponse.data.items,
            payments: [],
            notifications: notificationsResponse.data.items,
            recommendations: [],
          });
          setAnalytics({
            overview: {
              todayRevenue: 0,
              activeStudentsCount: 0,
              todayLessonsCount: 0,
              totalDebt: 0,
            },
            attendanceToday: {
              present: 0,
              expected: 0,
              absent: 0,
            },
            bestStaffMonth: null,
          });
          return;
        }

        const [
          childrenResponse,
          lessonsResponse,
          enrollmentsResponse,
          paymentsResponse,
          notificationsResponse,
          analyticsResponse,
        ] = await Promise.all([
          api.get("/children"),
          api.get("/lessons"),
          api.get("/enrollments"),
          api.get("/payments"),
          api.get("/notifications"),
          api.get("/analytics/overview"),
        ]);

        setData({
          children: childrenResponse.data.items,
          lessons: lessonsResponse.data.items,
          enrollments: enrollmentsResponse.data.items,
          payments: paymentsResponse.data.items,
          notifications: notificationsResponse.data.items,
          recommendations: [],
        });
        setAnalytics(analyticsResponse.data);
      } catch (error) {
        showToast({
          title: t("dashboard.loadFailed"),
          description: error.message,
          tone: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [showToast, t, user.role]);

  const parentNotifications = useMemo(
    () =>
      [...data.notifications]
        .map((notification) => ({
          ...notification,
          priority: resolveNotificationPriority(notification),
        }))
        .sort((left, right) => {
          const leftScore =
            (left.readAt ? 0 : 10) +
            (left.priority === "high" ? 3 : left.priority === "medium" ? 2 : 1);
          const rightScore =
            (right.readAt ? 0 : 10) +
            (right.priority === "high" ? 3 : right.priority === "medium" ? 2 : 1);

          return rightScore - leftScore;
        })
        .slice(0, 3),
    [data.notifications],
  );
  const childRecommendationMap = useMemo(
    () =>
      Object.fromEntries(
        data.recommendations.map((item) => [item.child.id, item]),
      ),
    [data.recommendations],
  );
  const parentChildSummaries = useMemo(
    () =>
      data.children.map((child) => {
        // На одном ребёнке собираем всё, что важно родителю на главной:
        // следующее занятие, остаток занятий, долг и посещаемость.
        const recommendation = childRecommendationMap[child.id];
        const childEnrollments = data.enrollments
          .filter(
            (enrollment) =>
              enrollment.childId === child.id &&
              enrollment.lesson &&
              enrollment.status !== "CANCELLED",
          )
          .sort(compareLessonDateTime);

        const nextEnrollment =
          childEnrollments.find((enrollment) => isFutureOrTodayLesson(enrollment)) ||
          childEnrollments[0] ||
          null;
        const todayEnrollment =
          childEnrollments.find((enrollment) => isTodayLesson(enrollment)) || null;
        const remainingLessons = childEnrollments.filter(
          (enrollment) =>
            enrollment.status === "BOOKED" && isFutureOrTodayLesson(enrollment),
        ).length;
        const debtItems = childEnrollments
          .filter((enrollment) => Number(enrollment.financials?.debt || 0) > 0)
          .map((enrollment) => ({
            id: enrollment.id,
            enrollmentId: enrollment.id,
            title: enrollment.lesson?.title,
            amount: Number(enrollment.financials?.debt || 0),
          }));
        const recordedAttendances = childEnrollments.filter(
          (enrollment) =>
            enrollment.attendance?.status === "PRESENT" ||
            enrollment.attendance?.status === "ABSENT" ||
            enrollment.status === "ATTENDED" ||
            enrollment.status === "MISSED",
        );
        const attendedCount = recordedAttendances.filter(
          (enrollment) =>
            enrollment.attendance?.status === "PRESENT" ||
            enrollment.status === "ATTENDED",
        ).length;
        const attendanceRate = recommendation?.metrics?.attendanceRate
          ? Math.round(Number(recommendation.metrics.attendanceRate))
          : recordedAttendances.length
            ? Math.round((attendedCount / recordedAttendances.length) * 100)
            : 0;

        return {
          child,
          nextEnrollment,
          todayEnrollment,
          remainingLessons,
          teacherName: nextEnrollment?.lesson?.teacherName || t("dashboard.parentNoTeacher"),
          nextLessonLabel: nextEnrollment
            ? `${formatDate(nextEnrollment.lesson?.date, locale)} • ${nextEnrollment.lesson?.startTime} - ${nextEnrollment.lesson?.endTime}`
            : t("dashboard.parentNoNextLesson"),
          paid: Number(child.financials?.paid || 0),
          debt: Number(child.financials?.debt || 0),
          debtItems,
          attendanceRate,
        };
      }),
    [childRecommendationMap, data.children, data.enrollments, locale, t],
  );
  const parentNextEnrollment = useMemo(
    () =>
      data.enrollments
        .filter(
          (enrollment) =>
            enrollment.lesson &&
            enrollment.status !== "CANCELLED" &&
            isFutureOrTodayLesson(enrollment),
        )
        .sort(compareLessonDateTime)
        .at(0) || null,
    [data.enrollments],
  );
  const parentTotals = useMemo(
    () =>
      parentChildSummaries.reduce(
        (summary, item) => ({
          paid: summary.paid + item.paid,
          debt: summary.debt + item.debt,
          remainingLessons: summary.remainingLessons + item.remainingLessons,
        }),
        { paid: 0, debt: 0, remainingLessons: 0 },
      ),
    [parentChildSummaries],
  );
  const parentTodayLessonsCount = useMemo(
    () =>
      parentChildSummaries.filter((item) => item.todayEnrollment).length,
    [parentChildSummaries],
  );
  const parentTotalAccrued = parentTotals.paid + parentTotals.debt;
  const parentFinanceProgress = parentTotalAccrued
    ? Math.round((parentTotals.paid / parentTotalAccrued) * 100)
    : 0;
  const parentMonthlyAttendance = useMemo(() => {
    // Родителю не нужна сырая таблица по всем посещениям, поэтому сразу считаем готовую метрику за текущий месяц.
    const now = new Date();
    const monthlyItems = data.enrollments.filter((enrollment) => {
      if (!enrollment.lesson) {
        return false;
      }

      const lessonDate = new Date(enrollment.lesson.date);

      return (
        lessonDate.getFullYear() === now.getFullYear() &&
        lessonDate.getMonth() === now.getMonth() &&
        enrollment.status !== "CANCELLED"
      );
    });

    const present = monthlyItems.filter(
      (enrollment) =>
        enrollment.attendance?.status === "PRESENT" ||
        enrollment.status === "ATTENDED",
    ).length;
    const absent = monthlyItems.filter(
      (enrollment) =>
        enrollment.attendance?.status === "ABSENT" ||
        enrollment.status === "MISSED",
    ).length;
    const total = present + absent;

    return {
      present,
      absent,
      total,
      rate: total ? Math.round((present / total) * 100) : 0,
    };
  }, [data.enrollments]);
  const attendanceTodayTotal =
    analytics.attendanceToday.present +
    analytics.attendanceToday.expected +
    analytics.attendanceToday.absent;
  const attendanceTodayItems = [
    {
      key: "present",
      icon: CheckCircle2,
      label: t("dashboard.attendanceArrived"),
      value: analytics.attendanceToday.present,
      tone: "success",
    },
    {
      key: "expected",
      icon: Clock3,
      label: t("dashboard.attendanceExpected"),
      value: analytics.attendanceToday.expected,
      tone: "warning",
    },
    {
      key: "absent",
      icon: AlertTriangle,
      label: t("dashboard.attendanceMissed"),
      value: analytics.attendanceToday.absent,
      tone: "danger",
    },
  ];
  const quickActions = [
    {
      key: "scan",
      label: t("dashboard.actionScanQr"),
      icon: QrCode,
      onClick: () => navigate("/attendance?mode=scan"),
    },
    {
      key: "payment",
      label: t("dashboard.actionTakePayment"),
      icon: Wallet,
      onClick: () => navigate("/payments?mode=accept"),
    },
    {
      key: "child",
      label: t("dashboard.actionAddChild"),
      icon: UserPlus,
      onClick: () => navigate("/children?mode=create"),
    },
    {
      key: "lesson",
      label: t("dashboard.actionAddLesson"),
      icon: PlusSquare,
      onClick: () => navigate("/lessons?mode=create"),
    },
  ];
  const teacherLessons = useMemo(
    () => [...data.lessons].sort(compareLessonDateTime),
    [data.lessons],
  );
  const teacherTodayLessons = useMemo(
    () => teacherLessons.filter((lesson) => isTodayLesson(lesson)),
    [teacherLessons],
  );
  const teacherUpcomingLessons = useMemo(
    () => teacherLessons.filter((lesson) => isFutureOrTodayLesson(lesson)).slice(0, 4),
    [teacherLessons],
  );
  const teacherStudentCount = useMemo(
    () =>
      new Set(
        data.enrollments
          .filter((enrollment) => enrollment.status !== "CANCELLED")
          .map((enrollment) => enrollment.childId),
      ).size,
    [data.enrollments],
  );
  const teacherNotifications = data.notifications.slice(0, 3);
  const teacherUnreadNotifications = useMemo(
    () => data.notifications.filter((notification) => !notification.readAt).length,
    [data.notifications],
  );
  const teacherTodayAttendance = useMemo(
    () =>
      data.enrollments
        .filter(
          (enrollment) =>
            enrollment.lesson &&
            enrollment.status !== "CANCELLED" &&
            isTodayLesson(enrollment),
        )
        .reduce(
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
              summary.pending += 1;
            }

            return summary;
          },
          { present: 0, absent: 0, pending: 0 },
        ),
    [data.enrollments],
  );
  const teacherLessonCounts = useMemo(
    () =>
      data.enrollments.reduce((summary, enrollment) => {
        if (enrollment.status === "CANCELLED") {
          return summary;
        }

        summary[enrollment.lessonId] = (summary[enrollment.lessonId] || 0) + 1;
        return summary;
      }, {}),
    [data.enrollments],
  );

  if (user.role === "ADMIN") {
    return (
      <div className="stack-xl">
        <PageHeader title="Панель администратора" />

        <section className="grid-cards">
          <StatCard
            icon={Users}
            label="Родители"
            value={analytics.overview.parentsCount || 0}
            tone="blue"
          />
          <StatCard
            icon={Users}
            label="Дети"
            value={analytics.overview.childrenCount || data.children.length}
            tone="mint"
          />
          <StatCard
            icon={CalendarDays}
            label="Преподаватели"
            value={analytics.teacherPerformance?.length || 0}
            tone="blue"
          />
          <StatCard
            icon={AlertTriangle}
            label="Общий долг"
            value={formatCurrency(analytics.overview.totalDebt, "kzt", locale)}
            tone="orange"
          />
          <StatCard
            icon={CalendarDays}
            label="Занятия сегодня"
            value={analytics.overview.todayLessonsCount}
            tone="blue"
          />
        </section>

        <section className="two-column">
          <article className="panel stack-md">
            <div className="panel__header">
              <div>
                <h2>Сегодняшние занятия</h2>
              </div>
              <CalendarDays size={18} />
            </div>

            {data.lessons.length ? (
              data.lessons
                .filter((lesson) => isTodayLesson(lesson))
                .slice(0, 5)
                .map((lesson) => (
                  <article className="list-row" key={lesson.id}>
                    <div>
                      <strong>{lesson.title}</strong>
                      <span>
                        {lesson.startTime} - {lesson.endTime} • {lesson.teacherName}
                      </span>
                    </div>
                    <StatusBadge
                      status="BOOKED"
                      label={`${lesson.capacity - lesson.availableSpots}/${lesson.capacity}`}
                    />
                  </article>
                ))
            ) : (
              <div className="empty-state">{t("dashboard.noLessons")}</div>
            )}
          </article>

          <div className="stack-lg">
            <article className="panel stack-md">
              <div className="panel__header">
                <div>
                  <h2>Быстрые действия</h2>
                </div>
                <CreditCard size={18} />
              </div>

              <div className="quick-actions-grid">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.key}
                      type="button"
                      className="quick-action-card"
                      onClick={action.onClick}
                    >
                      <div className="quick-action-card__icon">
                        <Icon size={18} />
                      </div>
                      <strong>{action.label}</strong>
                    </button>
                  );
                })}
              </div>
            </article>

            <article className="panel stack-md">
              <div className="panel__header">
                <div>
                  <h2>Уведомления</h2>
                </div>
                <Bell size={18} />
              </div>

              {data.notifications.slice(0, 3).length ? (
                data.notifications.slice(0, 3).map((notification) => (
                  <article className="staff-notification-card" key={notification.id}>
                    <div className="staff-notification-card__head">
                      <div className="staff-notification-card__title">
                        <span
                          className={
                            notification.readAt
                              ? "staff-notification-card__dot"
                              : "staff-notification-card__dot staff-notification-card__dot--new"
                          }
                        />
                        <strong>{notification.title}</strong>
                      </div>
                      <StatusBadge
                        status={notification.readAt ? "ATTENDED" : "BOOKED"}
                        label={notification.readAt ? t("dashboard.read") : t("dashboard.new")}
                      />
                    </div>
                    <p>{notification.message}</p>
                  </article>
                ))
              ) : (
                <div className="empty-state">{t("dashboard.noNotifications")}</div>
              )}
            </article>
          </div>
        </section>

        <section className="two-column">
          <article className="panel stack-md">
            <div className="panel__header">
              <div>
                <h2>Посещаемость сегодня</h2>
              </div>
              <CheckCircle2 size={18} />
            </div>

            <div className="attendance-mini-grid">
              {attendanceTodayItems.map((item) => {
                const Icon = item.icon;
                const width = attendanceTodayTotal
                  ? Math.max(10, Math.round((item.value / attendanceTodayTotal) * 100))
                  : 0;

                return (
                  <article className={`attendance-mini-card attendance-mini-card--${item.tone}`} key={item.key}>
                    <div className="attendance-mini-card__head">
                      <div className="attendance-mini-card__icon">
                        <Icon size={18} />
                      </div>
                      <strong>{item.value}</strong>
                    </div>
                    <span>{item.label}</span>
                    <div className="attendance-mini-card__track">
                      <div className="attendance-mini-card__fill" style={{ width: `${width}%` }} />
                    </div>
                  </article>
                );
              })}
            </div>
          </article>

          <article className="panel stack-md">
            <div className="panel__header">
              <div>
                <h2>Финансы</h2>
              </div>
              <Wallet size={18} />
            </div>

            <div className="detail-grid">
              <div className="detail-card">
                <span>Выручка за сегодня</span>
                <strong>{formatCurrency(analytics.overview.todayRevenue, "kzt", locale)}</strong>
              </div>
              <div className="detail-card">
                <span>Общий долг</span>
                <strong>{formatCurrency(analytics.overview.totalDebt, "kzt", locale)}</strong>
              </div>
              <div className="detail-card">
                <span>Платежей сегодня</span>
                <strong>{data.payments.length}</strong>
              </div>
            </div>

            <div className="row-actions">
              <button
                type="button"
                className="button button--primary"
                onClick={() => navigate("/payments")}
              >
                <Wallet size={16} />
                Открыть финансы
              </button>
            </div>
          </article>
        </section>
      </div>
    );
  }

  if (user.role === "TEACHER") {
    return (
      <div className="stack-xl">
        <PageHeader title="Кабинет преподавателя" />

        <section className="grid-cards">
          <StatCard
            icon={CalendarDays}
            label="Сегодня занятий"
            value={teacherTodayLessons.length}
            tone="blue"
          />
          <StatCard
            icon={Users}
            label="Активные ученики"
            value={teacherStudentCount}
            tone="mint"
          />
          <StatCard
            icon={Clock3}
            label="Ближайшие занятия"
            value={teacherUpcomingLessons.length}
            tone="blue"
          />
          <StatCard
            icon={Bell}
            label="Новые уведомления"
            value={teacherUnreadNotifications}
            tone={teacherUnreadNotifications ? "orange" : "blue"}
          />
        </section>

        <section className="two-column">
          <article className="panel stack-md">
            <div className="panel__header">
              <div>
                <h2>Сегодня</h2>
              </div>
              <CalendarDays size={18} />
            </div>

            {teacherTodayLessons.length ? (
              teacherTodayLessons.map((lesson) => (
                <article className="list-row" key={lesson.id}>
                  <div>
                    <strong>{lesson.title}</strong>
                    <span>
                      {lesson.startTime} - {lesson.endTime}
                    </span>
                  </div>
                  <StatusBadge
                    status="BOOKED"
                    label={`${teacherLessonCounts[lesson.id] || 0}/${lesson.capacity}`}
                  />
                </article>
              ))
            ) : (
              <div className="empty-state">На сегодня занятий нет</div>
            )}
          </article>

          <article className="panel stack-md">
            <div className="panel__header">
              <div>
                <h2>Быстрые действия</h2>
              </div>
              <BookOpen size={18} />
            </div>

            <div className="row-actions">
              <button
                type="button"
                className="button button--primary"
                onClick={() => navigate("/attendance?mode=scan")}
              >
                <QrCode size={16} />
                Отметить посещаемость
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => navigate("/journal")}
              >
                <BookOpen size={16} />
                Журнал
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => navigate("/feedback")}
              >
                <MessageSquareMore size={16} />
                Сообщения
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => navigate("/lessons")}
              >
                <CalendarDays size={16} />
                Расписание
              </button>
            </div>
          </article>
        </section>

        <section className="two-column">
          <article className="panel stack-md">
            <div className="panel__header">
              <div>
                <h2>Статус посещаемости</h2>
              </div>
              <CheckCircle2 size={18} />
            </div>

            <div className="detail-grid">
              <div className="detail-card">
                <span>Были</span>
                <strong>{teacherTodayAttendance.present}</strong>
              </div>
              <div className="detail-card">
                <span>Ожидаются</span>
                <strong>{teacherTodayAttendance.pending}</strong>
              </div>
              <div className="detail-card">
                <span>Не были</span>
                <strong>{teacherTodayAttendance.absent}</strong>
              </div>
            </div>
          </article>

          <article className="panel stack-md">
            <div className="panel__header">
              <div>
                <h2>Уведомления</h2>
              </div>
              <Bell size={18} />
            </div>

            {teacherNotifications.length ? (
              teacherNotifications.map((notification) => (
                <article className="staff-notification-card" key={notification.id}>
                  <div className="staff-notification-card__head">
                    <div className="staff-notification-card__title">
                      <span
                        className={
                          notification.readAt
                            ? "staff-notification-card__dot"
                            : "staff-notification-card__dot staff-notification-card__dot--new"
                        }
                      />
                      <strong>{notification.title}</strong>
                    </div>
                    <StatusBadge
                      status={notification.readAt ? "ATTENDED" : "BOOKED"}
                      label={notification.readAt ? t("dashboard.read") : t("dashboard.new")}
                    />
                  </div>
                  <p>{notification.message}</p>
                </article>
              ))
            ) : (
              <div className="empty-state">{t("dashboard.noNotifications")}</div>
            )}
          </article>
        </section>
      </div>
    );
  }

  return (
    <div className="stack-xl">
      <PageHeader
        title={t("dashboard.welcome", {
          name: user.fullName.split(" ")[0],
        })}
      />

      <section className="parent-summary-strip">
        <div className="parent-summary-strip__item">
          <span>{t("dashboard.statChildren")}</span>
          <strong>{parentChildSummaries.length}</strong>
        </div>
        <div className="parent-summary-strip__item">
          <span>{t("dashboard.parentTodayLesson")}</span>
          <strong>{parentTodayLessonsCount}</strong>
        </div>
        <div className="parent-summary-strip__item parent-summary-strip__item--danger">
          <span>{t("dashboard.parentDebt")}</span>
          <strong>{formatCurrency(parentTotals.debt, "kzt", locale)}</strong>
        </div>
      </section>

      <section className="parent-focus-grid">
        <article className="panel parent-focus-panel parent-focus-panel--finance">
          <div className="parent-section-head">
            <h2>{t("dashboard.parentFinanceTitle")}</h2>
            <Wallet size={18} />
          </div>

          <div className="parent-finance-overview">
            <div className="parent-finance-pill">
              <span>{t("dashboard.parentPaid")}</span>
              <strong>{formatCurrency(parentTotals.paid, "kzt", locale)}</strong>
            </div>
            <div className="parent-finance-pill parent-finance-pill--danger">
              <span>{t("dashboard.parentDebt")}</span>
              <strong>{formatCurrency(parentTotals.debt, "kzt", locale)}</strong>
            </div>
          </div>

          <div className="parent-progress-card">
            <div className="parent-progress-card__head">
              <strong>{t("dashboard.parentFinanceProgress")}</strong>
              <span>
                {formatCurrency(parentTotals.paid, "kzt", locale)} /{" "}
                {formatCurrency(parentTotalAccrued, "kzt", locale)}
              </span>
            </div>
            <div className="parent-progress">
              <div
                className="parent-progress__fill"
                style={{ width: `${parentFinanceProgress}%` }}
              />
            </div>
          </div>

          {parentTotals.debt > 0 ? (
            <div className="parent-debt-list">
              {parentChildSummaries
                .filter((item) => item.debt > 0)
                .flatMap((item) =>
                  item.debtItems.map((debt) => (
                    <div className="parent-debt-list__item" key={debt.id}>
                      <div>
                        <strong>{debt.title}</strong>
                        <span>{item.child.fullName}</span>
                      </div>
                      <strong>{formatCurrency(debt.amount, "kzt", locale)}</strong>
                    </div>
                  )),
                )}
            </div>
          ) : (
            <div className="parent-inline-ok">
              <CheckCircle2 size={18} />
              <strong>{t("dashboard.parentNoDebt")}</strong>
            </div>
          )}

          <button
            type="button"
            className="button button--primary button--large"
            onClick={() => navigate("/payments")}
          >
            <CreditCard size={18} />
            {t("dashboard.parentPayAllAction")}
          </button>
        </article>

        <article className="panel parent-focus-panel">
          <div className="parent-section-head">
            <h2>{t("dashboard.parentNextLessonTitle")}</h2>
            <CalendarDays size={18} />
          </div>

          {parentNextEnrollment ? (
            <article className="parent-next-lesson">
              <strong className="parent-next-lesson__title">
                {parentNextEnrollment.lesson?.title}
              </strong>
              <div className="parent-next-lesson__meta">
                <span>{formatDate(parentNextEnrollment.lesson?.date, locale)}</span>
                <span>
                  {parentNextEnrollment.lesson?.startTime} -{" "}
                  {parentNextEnrollment.lesson?.endTime}
                </span>
                <span>{parentNextEnrollment.child?.fullName}</span>
                <span>{parentNextEnrollment.lesson?.teacherName}</span>
              </div>
              <div className="parent-next-lesson__actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() =>
                    navigate(`/attendance?enrollmentId=${parentNextEnrollment.id}`)
                  }
                >
                  <QrCode size={16} />
                  {t("dashboard.parentQrAction")}
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => navigate("/feedback")}
                >
                  <MessageSquareMore size={16} />
                  {t("dashboard.parentWriteAction")}
                </button>
              </div>
            </article>
          ) : (
            <div className="empty-state">{t("dashboard.parentNoLessons")}</div>
          )}

          <div className="parent-attendance-inline">
            <span>{t("dashboard.parentMonthAttendance")}</span>
            <strong>{formatPercent(parentMonthlyAttendance.rate)}</strong>
          </div>
        </article>
      </section>

      <section className="panel parent-children-panel">
        <div className="parent-section-head">
          <h2>{t("dashboard.statChildren")}</h2>
          <Link className="staff-dashboard__link" to="/children">
            {t("dashboard.parentOpenAllChildren")}
            <MoveRight size={16} />
          </Link>
        </div>

        <section className="parent-child-grid">
        {loading ? (
          <div className="empty-state empty-state--large">{t("dashboard.loadingChildren")}</div>
        ) : parentChildSummaries.length ? (
          parentChildSummaries.map((item) => (
            <article className="parent-child-card parent-child-card--compact" key={item.child.id}>
              <div className="parent-child-card__head">
                <div>
                  <h2>{item.child.fullName}</h2>
                  <span>{item.nextLessonLabel}</span>
                </div>
                <StatusBadge
                  status={item.debt > 0 ? "FAILED" : "SUCCEEDED"}
                  label={
                    item.debt > 0
                      ? t("dashboard.parentDebtAlert")
                      : t("dashboard.parentNoDebt")
                  }
                />
              </div>

              <div className="parent-child-card__compact-meta">
                <span>{item.nextEnrollment?.lesson?.title || t("dashboard.parentNoCourse")}</span>
                <span>{formatPercent(item.attendanceRate)}</span>
              </div>

              <div className="row-actions">
                <button
                  type="button"
                  className="button button--secondary button--full"
                  onClick={() => navigate("/children")}
                >
                  {t("dashboard.parentOpenChild")}
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state empty-state--large">{t("dashboard.parentNoChildren")}</div>
        )}
        </section>
      </section>

      <section className="panel parent-notifications-panel">
        <div className="parent-section-head">
          <h2>{t("dashboard.notificationsTitle")}</h2>
          <Link className="staff-dashboard__link" to="/notifications">
            {t("dashboard.viewAll")}
            <MoveRight size={16} />
          </Link>
        </div>

        {parentNotifications.length ? (
          <div className="stack-md">
            {parentNotifications.map((notification) => (
              <article className="parent-notification-card" key={notification.id}>
                <div className="parent-notification-card__head">
                  <div>
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                  </div>
                  <span
                    className={`notification-priority notification-priority--${notification.priority}`}
                  >
                    {t(`notifications.priority${notification.priority.charAt(0).toUpperCase()}${notification.priority.slice(1)}`)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">{t("dashboard.noNotifications")}</div>
        )}
      </section>
    </div>
  );
}
