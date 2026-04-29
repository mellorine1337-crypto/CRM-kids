import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import { formatDateTime } from "../utils/format.js";

export function NotificationsPage() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState([]);

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
      <PageHeader
        title={t("notifications.title")}
        description={
          user.role === "PARENT"
            ? t("notifications.parentDescription")
            : t("notifications.description")
        }
      />

      <section className="stack-md">
        {notifications.map((notification) => (
          <article className="panel panel--notification" key={notification.id}>
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
        {!notifications.length ? (
          <div className="empty-state">{t("notifications.noItems")}</div>
        ) : null}
      </section>
    </div>
  );
}
