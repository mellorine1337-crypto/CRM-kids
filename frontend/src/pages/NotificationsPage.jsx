import { BellRing } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import { formatDateTime } from "../utils/format.js";
import { resolveNotificationPriority } from "../utils/notifications.js";

export function NotificationsPage() {
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("all");

  const loadNotifications = async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(data.items);
    } catch (error) {
      showToast({
        title: t("notifications.loadFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const { data } = await api.get("/notifications");
        setNotifications(data.items);
      } catch (error) {
        showToast({
          title: t("notifications.loadFailed"),
          description: error.message,
          tone: "error",
        });
      }
    };

    bootstrap();
  }, [showToast, t]);

  const enrichedNotifications = useMemo(
    () =>
      notifications.map((notification) => ({
        ...notification,
        priority: resolveNotificationPriority(notification),
      })),
    [notifications],
  );

  const displayedNotifications = useMemo(
    () =>
      filter === "important"
        ? enrichedNotifications.filter((notification) => notification.priority === "high")
        : enrichedNotifications,
    [enrichedNotifications, filter],
  );

  const handleRead = async (notification) => {
    try {
      await api.patch(`/notifications/${notification.id}/read`);
      await loadNotifications();
    } catch (error) {
      showToast({
        title: t("notifications.updateFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  return (
    <div className="stack-xl">
      <PageHeader title={t("notifications.title")} />

      <div className="row-actions">
        <button
          type="button"
          className={filter === "all" ? "button button--primary" : "button button--secondary"}
          onClick={() => setFilter("all")}
        >
          {t("notifications.filterAll")}
        </button>
        <button
          type="button"
          className={
            filter === "important" ? "button button--primary" : "button button--secondary"
          }
          onClick={() => setFilter("important")}
        >
          {t("notifications.filterImportant")}
        </button>
      </div>

      <section className="stack-md">
        {displayedNotifications.map((notification) => (
          <article className="panel panel--notification parent-notification-card" key={notification.id}>
            <div className="panel__header">
              <div className="panel__title">
                <BellRing size={18} />
                <div>
                  <h2>{notification.title}</h2>
                  <p>{formatDateTime(notification.sentAt, locale)}</p>
                </div>
              </div>
              <StatusBadge
                status={notification.readAt ? "ATTENDED" : "BOOKED"}
                label={notification.readAt ? t("notifications.read") : t("notifications.unread")}
              />
            </div>
            <div className="row-actions">
              <span
                className={`notification-priority notification-priority--${notification.priority}`}
              >
                {t(
                  `notifications.priority${notification.priority.charAt(0).toUpperCase()}${notification.priority.slice(1)}`,
                )}
              </span>
            </div>
            <p>{notification.message}</p>
            {!notification.readAt ? (
              <button
                type="button"
                className="button button--ghost"
                onClick={() => handleRead(notification)}
              >
                {t("notifications.markRead")}
              </button>
            ) : null}
          </article>
        ))}
        {!displayedNotifications.length ? (
          <div className="empty-state">{t("notifications.noItems")}</div>
        ) : null}
      </section>
    </div>
  );
}
