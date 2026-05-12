// Кратко: рекомендации по детям и учебному процессу для административной роли.
import {
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { StatCard } from "../components/StatCard.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import { formatPercent } from "../utils/format.js";

const emptyData = {
  items: [],
  summary: {
    totalChildren: 0,
    totalRecommendations: 0,
    highRiskCount: 0,
    mediumRiskCount: 0,
    lowRiskCount: 0,
    highPriorityChildren: 0,
  },
  generatedAt: null,
};

// React-компонент RecommendationsPage: собирает экран и связывает его с состоянием и API.
export function RecommendationsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [data, setData] = useState(emptyData);

  useEffect(() => {
    // Функция loadRecommendations: загружает данные и обновляет состояние.
    const loadRecommendations = async () => {
      try {
        const { data: response } = await api.get("/recommendations");
        setData(response);
      } catch (error) {
        showToast({
          title: t("recommendations.loadFailed"),
          description: error.message,
          tone: "error",
        });
      }
    };

    loadRecommendations();
  }, [showToast, t]);

  return (
    <div className="stack-xl">
      <PageHeader
        title={t("recommendations.title")}
        description={
          user.role === "PARENT"
            ? t("recommendations.descriptionParent")
            : t("recommendations.descriptionStaff")
        }
      />

      <section className="grid-cards">
        <StatCard
          icon={Sparkles}
          label={t("recommendations.statChildren")}
          value={data.summary.totalChildren}
          tone="blue"
        />
        <StatCard
          icon={AlertTriangle}
          label={t("recommendations.statHighRisk")}
          value={data.summary.highRiskCount}
          tone="orange"
        />
        <StatCard
          icon={Target}
          label={t("recommendations.statHighPriority")}
          value={data.summary.highPriorityChildren}
          tone="mint"
        />
        <StatCard
          icon={ShieldCheck}
          label={t("recommendations.statStable")}
          value={data.summary.lowRiskCount}
          tone="blue"
        />
      </section>

      {data.items.length ? (
        <section className="card-grid">
          {data.items.map((item) => (
            <article className="panel recommendation-card" key={item.child.id}>
              <div className="panel__header">
                <div>
                  <h2>{item.child.fullName}</h2>
                  <p>{item.child.parent?.fullName || t("recommendations.noParent")}</p>
                </div>
                <StatusBadge
                  status={item.riskLevel}
                  label={t(`recommendations.riskLevels.${item.riskLevel}`)}
                />
              </div>

              <div className="detail-grid">
                <div className="detail-card">
                  <span>{t("recommendations.metrics.attendance")}</span>
                  <strong>{formatPercent(item.metrics.attendanceRate)}</strong>
                </div>
                <div className="detail-card">
                  <span>{t("recommendations.metrics.averageScore")}</span>
                  <strong>{item.metrics.averageScore || t("recommendations.noScore")}</strong>
                </div>
                <div className="detail-card">
                  <span>{t("recommendations.metrics.overdueHomework")}</span>
                  <strong>{item.metrics.overdueHomeworkCount}</strong>
                </div>
                <div className="detail-card">
                  <span>{t("recommendations.metrics.unpaid")}</span>
                  <strong>{item.metrics.unpaidCount}</strong>
                </div>
              </div>

              <div className="stack-md">
                {item.recommendations.map((recommendation, index) => (
                  <div className="recommendation-item" key={`${item.child.id}-${index}`}>
                    <div className="recommendation-item__head">
                      <strong>{recommendation.title}</strong>
                      <span
                        className={`priority-pill priority-pill--${recommendation.priority}`}
                      >
                        {t(`recommendations.priorities.${recommendation.priority}`)}
                      </span>
                    </div>
                    <p>{recommendation.description}</p>
                  </div>
                ))}
              </div>

              <div className="detail-card">
                <span>{t("recommendations.riskScore")}</span>
                <strong>{item.riskScore}</strong>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="panel empty-state">{t("recommendations.empty")}</div>
      )}
    </div>
  );
}
