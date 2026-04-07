import {
  Bell,
  CalendarDays,
  CreditCard,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { StatCard } from "../components/StatCard.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import { formatCurrency, formatDate } from "../utils/format.js";

export function DashboardPage() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const [data, setData] = useState({
    children: [],
    lessons: [],
    enrollments: [],
    payments: [],
    notifications: [],
    recommendations: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const enrollmentEndpoint =
          user.role === "PARENT" ? "/enrollments/my" : "/enrollments";
        const paymentEndpoint =
          user.role === "PARENT" ? "/payments/my" : "/payments";
        const recommendationsRequest =
          user.role === "PARENT"
            ? api.get("/recommendations")
            : Promise.resolve({ data: { items: [] } });

        const [
          childrenResponse,
          lessonsResponse,
          enrollmentsResponse,
          paymentsResponse,
          notificationsResponse,
          recommendationsResponse,
        ] = await Promise.all([
          api.get("/children"),
          api.get("/lessons"),
          api.get(enrollmentEndpoint),
          api.get(paymentEndpoint),
          api.get("/notifications"),
          recommendationsRequest,
        ]);

        setData({
          children: childrenResponse.data.items,
          lessons: lessonsResponse.data.items,
          enrollments: enrollmentsResponse.data.items,
          payments: paymentsResponse.data.items,
          notifications: notificationsResponse.data.items,
          recommendations: recommendationsResponse.data.items,
        });
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

  const upcomingLessons = data.lessons.slice(0, 3);
  const recentEnrollments = data.enrollments.slice(0, 4);
  const recentPayments = data.payments.slice(0, 4);
  const recommendationCards = data.recommendations.slice(0, 2);

  return (
    <div className="stack-xl">
      <PageHeader
        title={t("dashboard.welcome", {
          name: user.fullName.split(" ")[0],
        })}
        description={t("dashboard.description")}
      />

      <section className="grid-cards">
        <StatCard
          icon={Users}
          label={t("dashboard.statChildren")}
          value={data.children.length}
          tone="blue"
        />
        <StatCard
          icon={CalendarDays}
          label={t("dashboard.statUpcomingLessons")}
          value={data.lessons.length}
          tone="mint"
        />
        <StatCard
          icon={Sparkles}
          label={t("dashboard.statEnrollments")}
          value={data.enrollments.length}
          tone="orange"
        />
        <StatCard
          icon={CreditCard}
          label={t("dashboard.statPayments")}
          value={data.payments.length}
          tone="blue"
        />
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel__header">
            <div>
              <h2>{t("dashboard.nearestLessonsTitle")}</h2>
              <p>{t("dashboard.nearestLessonsDescription")}</p>
            </div>
          </div>
          {loading ? (
            <div className="empty-state">{t("dashboard.loadingLessons")}</div>
          ) : upcomingLessons.length ? (
            <div className="stack-md">
              {upcomingLessons.map((lesson) => (
                <div className="list-row" key={lesson.id}>
                  <div>
                    <strong>{lesson.title}</strong>
                    <span>
                      {formatDate(lesson.date, locale)} • {lesson.startTime} -{" "}
                      {lesson.endTime}
                    </span>
                  </div>
                  <StatusBadge
                    status={lesson.availableSpots > 0 ? "BOOKED" : "CANCELLED"}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">{t("dashboard.noLessons")}</div>
          )}
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <h2>{t("dashboard.notificationsTitle")}</h2>
              <p>{t("dashboard.notificationsDescription")}</p>
            </div>
            <Bell size={18} />
          </div>
          {loading ? (
            <div className="empty-state">{t("dashboard.loadingNotifications")}</div>
          ) : data.notifications.length ? (
            <div className="stack-md">
              {data.notifications.slice(0, 4).map((notification) => (
                <div className="list-row" key={notification.id}>
                  <div>
                    <strong>{notification.title}</strong>
                    <span>{notification.message}</span>
                  </div>
                  <StatusBadge
                    status={notification.readAt ? "ATTENDED" : "BOOKED"}
                    label={notification.readAt ? t("dashboard.read") : t("dashboard.new")}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">{t("dashboard.noNotifications")}</div>
          )}
        </article>
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel__header">
            <div>
              <h2>{t("dashboard.latestEnrollmentsTitle")}</h2>
              <p>{t("dashboard.latestEnrollmentsDescription")}</p>
            </div>
          </div>
          {recentEnrollments.length ? (
            <div className="stack-md">
              {recentEnrollments.map((enrollment) => (
                <div className="list-row" key={enrollment.id}>
                  <div>
                    <strong>{enrollment.child?.fullName}</strong>
                    <span>{enrollment.lesson?.title}</span>
                  </div>
                  <StatusBadge status={enrollment.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">{t("dashboard.noEnrollments")}</div>
          )}
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <h2>{t("dashboard.recentPaymentsTitle")}</h2>
              <p>{t("dashboard.recentPaymentsDescription")}</p>
            </div>
          </div>
          {recentPayments.length ? (
            <div className="stack-md">
              {recentPayments.map((payment) => (
                <div className="list-row" key={payment.id}>
                  <div>
                    <strong>{payment.enrollment?.lesson?.title}</strong>
                    <span>
                      {formatCurrency(payment.amount, payment.currency, locale)}
                    </span>
                  </div>
                  <StatusBadge status={payment.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">{t("dashboard.noPayments")}</div>
          )}
        </article>
      </section>

      {user.role === "PARENT" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>{t("dashboard.recommendationsTitle")}</h2>
              <p>{t("dashboard.recommendationsDescription")}</p>
            </div>
          </div>

          {recommendationCards.length ? (
            <div className="card-grid">
              {recommendationCards.map((item) => (
                <div className="detail-card detail-card--highlight" key={item.child.id}>
                  <span>{item.child.fullName}</span>
                  <strong>{item.recommendations[0]?.title}</strong>
                  <p>{item.recommendations[0]?.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">{t("dashboard.noRecommendations")}</div>
          )}
        </section>
      ) : null}
    </div>
  );
}
