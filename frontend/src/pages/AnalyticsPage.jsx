import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CreditCard,
  GraduationCap,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { StatCard } from "../components/StatCard.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPercent,
} from "../utils/format.js";

const emptyAnalytics = {
  overview: {
    parentsCount: 0,
    childrenCount: 0,
    monthRevenue: 0,
    attendanceRate: 0,
    activeEnrollmentsCount: 0,
    unpaidEnrollmentsCount: 0,
    missedEnrollmentsCount: 0,
    averageOccupancy: 0,
  },
  funnel: {
    leads: 0,
    booked: 0,
    paid: 0,
    attended: 0,
  },
  attendance: {
    presentCount: 0,
    absentCount: 0,
    rate: 0,
  },
  payments: {
    pendingCount: 0,
    succeededCount: 0,
    failedCount: 0,
    cancelledCount: 0,
  },
  revenueByMonth: [],
  popularLessons: [],
  upcomingLoad: [],
  teacherPerformance: [],
  churnRisk: [],
  recommendationInsights: {
    totalChildren: 0,
    highRiskCount: 0,
    mediumRiskCount: 0,
    lowRiskCount: 0,
    highPriorityChildren: 0,
  },
  risk: {
    unpaidEnrollmentsCount: 0,
    missedEnrollmentsCount: 0,
    pendingPaymentsCount: 0,
  },
  generatedAt: null,
};

export function AnalyticsPage() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const [analytics, setAnalytics] = useState(emptyAnalytics);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const { data } = await api.get("/analytics/overview");
        setAnalytics(data);
      } catch (error) {
        showToast({
          title: t("analytics.loadFailed"),
          description: error.message,
          tone: "error",
        });
      }
    };

    if (user.role === "ADMIN") {
      loadAnalytics();
    }
  }, [showToast, t, user.role]);

  const maxRevenue = useMemo(
    () =>
      Math.max(
        1,
        ...analytics.revenueByMonth.map((item) => Number(item.amount) || 0),
      ),
    [analytics.revenueByMonth],
  );

  const maxPopularLesson = useMemo(
    () =>
      Math.max(
        1,
        ...analytics.popularLessons.map((lesson) => lesson.bookedCount || 0),
      ),
    [analytics.popularLessons],
  );

  const maxTeacherEffectiveness = useMemo(
    () =>
      Math.max(
        1,
        ...analytics.teacherPerformance.map((teacher) => teacher.effectivenessScore || 0),
      ),
    [analytics.teacherPerformance],
  );

  if (user.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="stack-xl">
      <PageHeader
        title={t("analytics.title")}
        description={t("analytics.description")}
        action={
          analytics.generatedAt ? (
            <span className="analytics-generated-at">
              {t("analytics.generatedAt")}: {formatDateTime(analytics.generatedAt, locale)}
            </span>
          ) : null
        }
      />

      <section className="grid-cards">
        <StatCard
          icon={Users}
          label={t("analytics.statParents")}
          value={analytics.overview.parentsCount}
          tone="blue"
        />
        <StatCard
          icon={GraduationCap}
          label={t("analytics.statChildren")}
          value={analytics.overview.childrenCount}
          tone="mint"
        />
        <StatCard
          icon={TrendingUp}
          label={t("analytics.statRevenue")}
          value={formatCurrency(analytics.overview.monthRevenue, "kzt", locale)}
          tone="orange"
        />
        <StatCard
          icon={CalendarDays}
          label={t("analytics.statAttendance")}
          value={formatPercent(analytics.overview.attendanceRate)}
          tone="blue"
        />
        <StatCard
          icon={BarChart3}
          label={t("analytics.statActiveEnrollments")}
          value={analytics.overview.activeEnrollmentsCount}
          tone="mint"
        />
        <StatCard
          icon={Receipt}
          label={t("analytics.statUnpaid")}
          value={analytics.overview.unpaidEnrollmentsCount}
          tone="orange"
        />
        <StatCard
          icon={AlertTriangle}
          label={t("analytics.statMissed")}
          value={analytics.overview.missedEnrollmentsCount}
          tone="orange"
        />
        <StatCard
          icon={CreditCard}
          label={t("analytics.statOccupancy")}
          value={formatPercent(analytics.overview.averageOccupancy)}
          tone="blue"
        />
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel__header">
            <div>
              <h2>{t("analytics.revenueTitle")}</h2>
              <p>{t("analytics.revenueDescription")}</p>
            </div>
          </div>

          {analytics.revenueByMonth.length ? (
            <div className="analytics-bars">
              {analytics.revenueByMonth.map((item) => (
                <div className="analytics-bar-row" key={item.key}>
                  <div className="analytics-bar-row__label">
                    <strong>{item.label}</strong>
                    <span>{`${t("analytics.paymentsCount")}: ${item.paymentsCount}`}</span>
                  </div>
                  <div className="analytics-bar-track">
                    <div
                      className="analytics-bar-fill"
                      style={{
                        width: `${Math.max(
                          8,
                          Math.round((item.amount / maxRevenue) * 100),
                        )}%`,
                      }}
                    />
                  </div>
                  <strong>{formatCurrency(item.amount, "kzt", locale)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">{t("analytics.noRevenue")}</div>
          )}
        </article>

        <article className="panel stack-lg">
          <div className="panel__header">
            <div>
              <h2>{t("analytics.paymentsTitle")}</h2>
              <p>{t("analytics.paymentsDescription")}</p>
            </div>
          </div>

          <div className="analytics-chip-grid">
            <div className="analytics-chip">
              <StatusBadge status="PENDING" />
              <strong>{analytics.payments.pendingCount}</strong>
            </div>
            <div className="analytics-chip">
              <StatusBadge status="SUCCEEDED" />
              <strong>{analytics.payments.succeededCount}</strong>
            </div>
            <div className="analytics-chip">
              <StatusBadge status="FAILED" />
              <strong>{analytics.payments.failedCount}</strong>
            </div>
            <div className="analytics-chip">
              <StatusBadge status="CANCELLED" />
              <strong>{analytics.payments.cancelledCount}</strong>
            </div>
          </div>

          <div className="analytics-funnel">
            <div className="panel__header">
              <div>
                <h2>{t("analytics.funnelTitle")}</h2>
                <p>{t("analytics.funnelDescription")}</p>
              </div>
            </div>

            {[
              { key: "leads", label: t("analytics.leads"), value: analytics.funnel.leads },
              { key: "booked", label: t("analytics.bookedStep"), value: analytics.funnel.booked },
              { key: "paid", label: t("analytics.paidStep"), value: analytics.funnel.paid },
              {
                key: "attended",
                label: t("analytics.attendedStep"),
                value: analytics.funnel.attended,
              },
            ].map((step, index, steps) => {
              const baseValue = steps[0].value || 1;

              return (
                <div className="analytics-funnel__item" key={step.key}>
                  <div className="analytics-funnel__label">
                    <strong>{step.label}</strong>
                    <span>{step.value}</span>
                  </div>
                  <div className="analytics-bar-track">
                    <div
                      className="analytics-bar-fill analytics-bar-fill--mint"
                      style={{
                        width: `${Math.max(
                          index === 0 ? 100 : 12,
                          Math.round((step.value / baseValue) * 100),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel__header">
            <div>
              <h2>{t("analytics.popularTitle")}</h2>
              <p>{t("analytics.popularDescription")}</p>
            </div>
          </div>

          {analytics.popularLessons.length ? (
            <div className="analytics-bars">
              {analytics.popularLessons.map((lesson) => (
                <div className="analytics-bar-row" key={lesson.id}>
                  <div className="analytics-bar-row__label">
                    <strong>{lesson.title}</strong>
                    <span>{`${t("analytics.teacher")}: ${lesson.teacherName}`}</span>
                  </div>
                  <div className="analytics-bar-track">
                    <div
                      className="analytics-bar-fill analytics-bar-fill--accent"
                      style={{
                        width: `${Math.max(
                          10,
                          Math.round((lesson.bookedCount / maxPopularLesson) * 100),
                        )}%`,
                      }}
                    />
                  </div>
                  <strong>{lesson.bookedCount}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">{t("analytics.noLessons")}</div>
          )}
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <h2>{t("analytics.upcomingTitle")}</h2>
              <p>{t("analytics.upcomingDescription")}</p>
            </div>
          </div>

          {analytics.upcomingLoad.length ? (
            <div className="stack-md">
              {analytics.upcomingLoad.map((lesson) => (
                <div className="analytics-upcoming-card" key={lesson.id}>
                  <div className="analytics-upcoming-card__head">
                    <div>
                      <strong>{lesson.title}</strong>
                      <span>
                        {formatDate(lesson.date, locale)} • {lesson.startTime}
                      </span>
                    </div>
                    <strong>{formatPercent(lesson.occupancyRate)}</strong>
                  </div>
                  <div className="analytics-bar-track">
                    <div
                      className="analytics-bar-fill"
                      style={{ width: `${Math.max(8, lesson.occupancyRate)}%` }}
                    />
                  </div>
                  <div className="analytics-upcoming-card__meta">
                    <span>{`${t("analytics.teacher")}: ${lesson.teacherName}`}</span>
                    <span>{`${t("analytics.booked")}: ${lesson.bookedCount}`}</span>
                    <span>{`${t("analytics.available")}: ${lesson.availableSpots}`}</span>
                    <span>{`${t("analytics.capacity")}: ${lesson.capacity}`}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">{t("analytics.noUpcoming")}</div>
          )}
        </article>
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel__header">
            <div>
              <h2>{t("analytics.teachersTitle")}</h2>
              <p>{t("analytics.teachersDescription")}</p>
            </div>
          </div>

          {analytics.teacherPerformance.length ? (
            <div className="analytics-bars">
              {analytics.teacherPerformance.map((teacher) => (
                <div className="analytics-bar-row" key={teacher.teacherName}>
                  <div className="analytics-bar-row__label">
                    <strong>{teacher.teacherName}</strong>
                    <span>
                      {`${teacher.studentsCount} ${t("analytics.studentsShort")} • ${teacher.lessonsCount} ${t("analytics.lessonsShort")}`}
                    </span>
                  </div>
                  <div className="analytics-bar-track">
                    <div
                      className="analytics-bar-fill analytics-bar-fill--mint"
                      style={{
                        width: `${Math.max(
                          12,
                          Math.round(
                            (teacher.effectivenessScore / maxTeacherEffectiveness) * 100,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="analytics-teacher-meta">
                    <span>{`${t("analytics.effectiveness")}: ${teacher.effectivenessScore}`}</span>
                    <span>{`${t("analytics.attendanceShort")}: ${formatPercent(
                      teacher.attendanceRate,
                    )}`}</span>
                    <span>{`${t("analytics.averageScoreShort")}: ${teacher.averageScore || 0}`}</span>
                    <span>{`${t("analytics.teacherRevenue")}: ${formatCurrency(
                      teacher.revenue,
                      "kzt",
                      locale,
                    )}`}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">{t("analytics.noTeachers")}</div>
          )}
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <h2>{t("analytics.churnTitle")}</h2>
              <p>{t("analytics.churnDescription")}</p>
            </div>
          </div>

          {analytics.churnRisk.length ? (
            <div className="stack-md">
              {analytics.churnRisk.map((item) => (
                <div className="analytics-risk-card" key={item.childId}>
                  <div className="journal-entry-card__head">
                    <strong>{item.childName}</strong>
                    <StatusBadge
                      status={item.riskLevel}
                      label={t(`recommendations.riskLevels.${item.riskLevel}`)}
                    />
                  </div>
                  <p>{item.parentName}</p>
                  <div className="analytics-upcoming-card__meta">
                    <span>{`${t("analytics.attendanceShort")}: ${formatPercent(
                      item.attendanceRate,
                    )}`}</span>
                    <span>{`${t("analytics.averageScoreShort")}: ${item.averageScore || 0}`}</span>
                    <span>{`${t("analytics.riskScore")}: ${item.riskScore}`}</span>
                  </div>
                  <div className="detail-card">
                    <span>{item.primaryRecommendation?.title}</span>
                    <strong>{item.primaryRecommendation?.description}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">{t("analytics.noChurn")}</div>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>{t("analytics.riskTitle")}</h2>
            <p>{t("analytics.riskDescription")}</p>
          </div>
        </div>

        <div className="analytics-chip-grid analytics-chip-grid--wide">
          <div className="analytics-risk-card">
            <span>{t("analytics.riskUnpaid")}</span>
            <strong>{analytics.risk.unpaidEnrollmentsCount}</strong>
          </div>
          <div className="analytics-risk-card">
            <span>{t("analytics.riskMissed")}</span>
            <strong>{analytics.risk.missedEnrollmentsCount}</strong>
          </div>
          <div className="analytics-risk-card">
            <span>{t("analytics.riskPendingPayments")}</span>
            <strong>{analytics.risk.pendingPaymentsCount}</strong>
          </div>
          <div className="analytics-risk-card">
            <span>{t("analytics.highRiskChildren")}</span>
            <strong>{analytics.recommendationInsights.highRiskCount}</strong>
          </div>
          <div className="analytics-risk-card">
            <span>{t("analytics.mediumRiskChildren")}</span>
            <strong>{analytics.recommendationInsights.mediumRiskCount}</strong>
          </div>
          <div className="analytics-risk-card">
            <span>{t("analytics.highPriorityChildren")}</span>
            <strong>{analytics.recommendationInsights.highPriorityChildren}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
