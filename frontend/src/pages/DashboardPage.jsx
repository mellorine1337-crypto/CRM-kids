import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  QrCode,
  MessageSquareMore,
  MoveRight,
  PlusSquare,
  Sparkles,
  Trophy,
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
import { formatCurrency, formatDate } from "../utils/format.js";
import {
  compareLessonDateTime,
  isFutureOrTodayLesson,
  isTodayLesson,
} from "../utils/schedule.js";

const getInitials = (value = "") =>
  value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

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
    const fetchDashboard = async () => {
      try {
        const enrollmentEndpoint =
          user.role === "PARENT" ? "/enrollments/my" : "/enrollments";
        const paymentEndpoint =
          user.role === "PARENT" ? "/payments/my" : "/payments";
        const lessonsRequest =
          user.role === "PARENT"
            ? Promise.resolve({ data: { items: [] } })
            : api.get("/lessons");
        const recommendationsRequest =
          user.role === "PARENT"
            ? api.get("/recommendations")
            : Promise.resolve({ data: { items: [] } });
        const analyticsRequest =
          user.role === "STAFF"
            ? api.get("/analytics/overview")
            : Promise.resolve({
                data: {
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
                },
              });

        const [
          childrenResponse,
          lessonsResponse,
          enrollmentsResponse,
          paymentsResponse,
          notificationsResponse,
          recommendationsResponse,
          analyticsResponse,
        ] = await Promise.all([
          api.get("/children"),
          lessonsRequest,
          api.get(enrollmentEndpoint),
          api.get(paymentEndpoint),
          api.get("/notifications"),
          recommendationsRequest,
          analyticsRequest,
        ]);

        setData({
          children: childrenResponse.data.items,
          lessons: lessonsResponse.data.items,
          enrollments: enrollmentsResponse.data.items,
          payments: paymentsResponse.data.items,
          notifications: notificationsResponse.data.items,
          recommendations: recommendationsResponse.data.items,
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

  const staffNotifications = data.notifications.slice(0, 3);
  const staffLessons = data.lessons.slice(0, 4);
  const parentNotifications = useMemo(
    () => data.notifications.slice(0, 4),
    [data.notifications],
  );
  const parentChildSummaries = useMemo(
    () =>
      data.children.map((child) => {
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
            title: enrollment.lesson?.title,
            amount: Number(enrollment.financials?.debt || 0),
          }));

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
        };
      }),
    [data.children, data.enrollments, locale, t],
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
  const parentAttendancePreview = useMemo(
    () =>
      [...data.enrollments]
        .filter((enrollment) => enrollment.lesson && enrollment.child)
        .sort((left, right) => compareLessonDateTime(right, left))
        .slice(0, 5),
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

  if (user.role === "STAFF") {
    return (
      <div className="stack-xl">
        <section className="grid-cards">
          <StatCard
            icon={Wallet}
            label={t("dashboard.revenueToday")}
            value={formatCurrency(analytics.overview.todayRevenue, "kzt", locale)}
            tone="blue"
          />
          <StatCard
            icon={Users}
            label={t("dashboard.activeStudents")}
            value={analytics.overview.activeStudentsCount}
            tone="mint"
          />
          <StatCard
            icon={CalendarDays}
            label={t("dashboard.lessonsToday")}
            value={analytics.overview.todayLessonsCount}
            tone="blue"
          />
          <StatCard
            icon={AlertTriangle}
            label={t("dashboard.totalDebt")}
            value={formatCurrency(analytics.overview.totalDebt, "kzt", locale)}
            tone="orange"
          />
        </section>

        <section className="staff-dashboard-grid">
          <article className="panel panel--hero">
            <div className="staff-dashboard__eyebrow">{t("dashboard.staffSummaryLabel")}</div>
            <div className="staff-dashboard__hero-card">
              <div className="staff-dashboard__hero-icon">
                <CalendarDays size={28} />
              </div>
              <div className="staff-dashboard__hero-copy">
                <h1>{t("dashboard.staffHeroTitle")}</h1>
                <p>{t("dashboard.staffHeroDescription")}</p>
                <div className="staff-dashboard__hero-stats">
                  <strong>{`${analytics.overview.todayLessonsCount} ${t("dashboard.staffLessonsCount")}`}</strong>
                  <span />
                  <strong>{`${analytics.overview.activeStudentsCount} ${t("dashboard.staffStudentsCount")}`}</strong>
                  <span />
                  <strong>{`${data.payments.length} ${t("dashboard.staffPaymentsCount")}`}</strong>
                </div>
              </div>
            </div>

            <div className="staff-dashboard__section-head">
              <div>
                <h2>{t("dashboard.attendanceTodayTitle")}</h2>
                <p>{t("dashboard.attendanceTodayDescription")}</p>
              </div>
              <Link className="staff-dashboard__link" to="/attendance?mode=scan">
                {t("dashboard.viewAll")}
                <MoveRight size={16} />
              </Link>
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

            <div className="staff-dashboard__section-head">
              <div>
                <h2>{t("dashboard.nearestLessonsTitle")}</h2>
                <p>{t("dashboard.staffLessonsDescription")}</p>
              </div>
              <Link className="staff-dashboard__link" to="/lessons">
                {t("dashboard.viewAll")}
                <MoveRight size={16} />
              </Link>
            </div>

            <div className="stack-md">
              {staffLessons.length ? (
                staffLessons.map((lesson) => (
                  <article className="staff-lesson-card" key={lesson.id}>
                    <div className="staff-lesson-card__copy">
                      <strong>{lesson.title}</strong>
                      <span>
                        {formatDate(lesson.date, locale)} • {lesson.startTime} - {lesson.endTime}
                      </span>
                      <div className="staff-lesson-card__meta">
                        <span>{lesson.teacherName}</span>
                        <span>{`${lesson.capacity - lesson.availableSpots}/${lesson.capacity}`}</span>
                      </div>
                    </div>
                    <div className="staff-avatar-chip">
                      <span>{getInitials(lesson.teacherName)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">{t("dashboard.noLessons")}</div>
              )}
            </div>
          </article>

          <div className="stack-lg">
            <article className="panel panel--side">
              <div className="staff-dashboard__section-head">
                <div>
                  <h2>{t("dashboard.bestStaffTitle")}</h2>
                  <p>{t("dashboard.bestStaffDescription")}</p>
                </div>
                <Trophy size={18} />
              </div>

              {analytics.bestStaffMonth ? (
                <article className="staff-best-card">
                  <div className="staff-best-card__avatar">
                    <span>{getInitials(analytics.bestStaffMonth.fullName)}</span>
                  </div>
                  <div className="staff-best-card__body">
                    <strong>{analytics.bestStaffMonth.fullName}</strong>
                    <span>
                      {t("dashboard.bestStaffRevenue")}:{" "}
                      {formatCurrency(analytics.bestStaffMonth.revenue, "kzt", locale)}
                    </span>
                    <span>
                      {t("dashboard.bestStaffStudents")}:{" "}
                      {analytics.bestStaffMonth.activeStudentsCount}
                    </span>
                  </div>
                </article>
              ) : (
                <div className="empty-state">{t("dashboard.bestStaffEmpty")}</div>
              )}
            </article>

            <article className="panel panel--side">
              <div className="staff-dashboard__section-head">
                <div>
                  <h2>{t("dashboard.quickActionsTitle")}</h2>
                  <p>{t("dashboard.quickActionsDescription")}</p>
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
          </div>
        </section>

        <section className="two-column">
          <article className="panel panel--side">
            <div className="staff-dashboard__section-head">
              <div>
                <h2>{t("dashboard.notificationsTitle")}</h2>
                <p>{t("dashboard.notificationsDescription")}</p>
              </div>
              <Bell size={18} />
            </div>

            <div className="stack-md">
              {staffNotifications.length ? (
                staffNotifications.map((notification) => (
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
            </div>

            <Link className="staff-dashboard__link" to="/notifications">
              {t("dashboard.viewAll")}
              <MoveRight size={16} />
            </Link>
          </article>

          <article className="panel panel--side">
            <div className="staff-dashboard__section-head">
              <div>
                <h2>{t("dashboard.staffFinanceTitle")}</h2>
                <p>{t("dashboard.debtSummary")}</p>
              </div>
              <MessageSquareMore size={18} />
            </div>

            <div className="staff-money-card">
              <span>{t("dashboard.revenueToday")}</span>
              <strong>{formatCurrency(analytics.overview.todayRevenue, "kzt", locale)}</strong>
            </div>

            <div className="staff-inline-alert staff-inline-alert--warning">
              <span className="staff-inline-alert__dot" />
              <strong>
                {`${t("dashboard.totalDebt")}: ${formatCurrency(analytics.overview.totalDebt, "kzt", locale)}`}
              </strong>
              <Link className="staff-dashboard__link" to="/payments">
                <MoveRight size={16} />
              </Link>
            </div>
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
        description={t("dashboard.parentDescription")}
      />

      <section className="two-column">
        <article className="panel panel--side">
          <div className="staff-dashboard__section-head">
            <div>
              <h2>{t("dashboard.parentNextLessonTitle")}</h2>
              <p>{t("dashboard.parentNextLessonDescription")}</p>
            </div>
            <CalendarDays size={18} />
          </div>

          {parentNextEnrollment ? (
            <article className="parent-hero-card">
              <div className="parent-hero-card__eyebrow">{t("dashboard.parentNearestLabel")}</div>
              <h2>{parentNextEnrollment.lesson?.title}</h2>
              <div className="parent-hero-card__meta">
                <span>{parentNextEnrollment.child?.fullName}</span>
                <span>{formatDate(parentNextEnrollment.lesson?.date, locale)}</span>
                <span>{`${parentNextEnrollment.lesson?.startTime} - ${parentNextEnrollment.lesson?.endTime}`}</span>
                <span>{parentNextEnrollment.lesson?.teacherName}</span>
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => navigate("/payments")}
                >
                  <CreditCard size={16} />
                  {t("dashboard.parentPayAction")}
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => navigate("/lessons")}
                >
                  <CalendarDays size={16} />
                  {t("dashboard.parentScheduleAction")}
                </button>
              </div>
            </article>
          ) : (
            <div className="empty-state">{t("dashboard.parentNoLessons")}</div>
          )}
        </article>

        <article className="panel panel--side">
          <div className="staff-dashboard__section-head">
            <div>
              <h2>{t("dashboard.parentFinanceTitle")}</h2>
              <p>{t("dashboard.parentFinanceDescription")}</p>
            </div>
            <Wallet size={18} />
          </div>

          <div className="parent-finance-summary">
            <div className="parent-finance-pill">
              <span>{t("dashboard.parentPaid")}</span>
              <strong>{formatCurrency(parentTotals.paid, "kzt", locale)}</strong>
            </div>
            <div
              className={
                parentTotals.debt > 0
                  ? "parent-finance-pill parent-finance-pill--danger"
                  : "parent-finance-pill"
              }
            >
              <span>{t("dashboard.parentDebt")}</span>
              <strong>{formatCurrency(parentTotals.debt, "kzt", locale)}</strong>
            </div>
          </div>

          {parentTotals.debt > 0 ? (
            <div className="parent-debt-list">
              {parentChildSummaries
                .filter((item) => item.debt > 0)
                .flatMap((item) =>
                  item.debtItems.map((debt) => (
                    <div className="parent-debt-list__item" key={debt.id}>
                      <strong>{item.child.fullName}</strong>
                      <span>{debt.title}</span>
                      <strong>{formatCurrency(debt.amount, "kzt", locale)}</strong>
                    </div>
                  )),
                )}
            </div>
          ) : (
            <div className="empty-state">{t("dashboard.parentNoDebt")}</div>
          )}
        </article>
      </section>

      <section className="card-grid">
        {loading ? (
          <div className="empty-state empty-state--large">{t("dashboard.loadingChildren")}</div>
        ) : parentChildSummaries.length ? (
          parentChildSummaries.map((item) => (
            <article className="parent-child-card" key={item.child.id}>
              <div className="parent-child-card__head">
                <div>
                  <span className="parent-child-card__eyebrow">{t("dashboard.parentChildLabel")}</span>
                  <h2>{item.child.fullName}</h2>
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

              <div className="parent-child-card__facts">
                <div className="detail-card">
                  <span>{t("dashboard.parentCourse")}</span>
                  <strong>{item.nextEnrollment?.lesson?.title || t("dashboard.parentNoCourse")}</strong>
                </div>
                <div className="detail-card">
                  <span>{t("dashboard.parentTeacher")}</span>
                  <strong>{item.teacherName}</strong>
                </div>
                <div className="detail-card">
                  <span>{t("dashboard.parentNextLesson")}</span>
                  <strong>{item.nextLessonLabel}</strong>
                </div>
                <div className="detail-card">
                  <span>{t("dashboard.parentRemainingLessons")}</span>
                  <strong>{item.remainingLessons}</strong>
                  {item.todayEnrollment ? <p>{t("dashboard.parentTodayBadge")}</p> : null}
                </div>
              </div>

              <div className="parent-child-card__finance">
                <div className="parent-finance-pill">
                  <span>{t("dashboard.parentPaid")}</span>
                  <strong>{formatCurrency(item.paid, "kzt", locale)}</strong>
                </div>
                <div
                  className={
                    item.debt > 0
                      ? "parent-finance-pill parent-finance-pill--danger"
                      : "parent-finance-pill"
                  }
                >
                  <span>{t("dashboard.parentDebt")}</span>
                  <strong>{formatCurrency(item.debt, "kzt", locale)}</strong>
                </div>
              </div>

              {item.debtItems.length ? (
                <div className="parent-debt-list">
                  {item.debtItems.map((debt) => (
                    <div className="parent-debt-list__item" key={debt.id}>
                      <span>{t("dashboard.parentDebtFor")}</span>
                      <strong>{debt.title}</strong>
                      <strong>{formatCurrency(debt.amount, "kzt", locale)}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="row-actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => navigate("/payments")}
                >
                  <CreditCard size={16} />
                  {t("dashboard.parentPayAction")}
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => navigate("/lessons")}
                >
                  <CalendarDays size={16} />
                  {t("dashboard.parentScheduleAction")}
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state empty-state--large">{t("dashboard.parentNoChildren")}</div>
        )}
      </section>

      <section className="two-column">
        <article className="panel panel--side">
          <div className="staff-dashboard__section-head">
            <div>
              <h2>{t("dashboard.parentAttendanceTitle")}</h2>
              <p>{t("dashboard.parentAttendanceDescription")}</p>
            </div>
            <CheckCircle2 size={18} />
          </div>

          {parentAttendancePreview.length ? (
            <div className="stack-md">
              {parentAttendancePreview.map((enrollment) => (
                <article className="parent-schedule-card" key={enrollment.id}>
                  <div className="parent-schedule-card__copy">
                    <strong>{formatDate(enrollment.lesson?.date, locale)}</strong>
                    <span>
                      {enrollment.child?.fullName} • {enrollment.lesson?.title}
                    </span>
                  </div>
                  <StatusBadge status={enrollment.attendance?.status || enrollment.status} />
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">{t("dashboard.parentNoAttendance")}</div>
          )}

          <Link className="staff-dashboard__link" to="/attendance">
            {t("dashboard.viewAll")}
            <MoveRight size={16} />
          </Link>
        </article>

        <article className="panel panel--side">
          <div className="staff-dashboard__section-head">
            <div>
              <h2>{t("dashboard.notificationsTitle")}</h2>
              <p>{t("dashboard.parentNotificationsDescription")}</p>
            </div>
            <Bell size={18} />
          </div>

          {parentNotifications.length ? (
            <div className="stack-md">
              {parentNotifications.map((notification) => (
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
              ))}
            </div>
          ) : (
            <div className="empty-state">{t("dashboard.noNotifications")}</div>
          )}

          <Link className="staff-dashboard__link" to="/notifications">
            {t("dashboard.viewAll")}
            <MoveRight size={16} />
          </Link>
        </article>
      </section>
    </div>
  );
}
