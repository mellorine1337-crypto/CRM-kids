import { Link2, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import { formatDateTime } from "../utils/format.js";

const defaultForm = {
  type: "SCHOOL_SYSTEM",
  name: "",
  description: "",
  status: "PLANNED",
  endpoint: "",
  notes: "",
};

const mapIntegrationToForm = (integration) => ({
  type: integration.type,
  name: integration.name,
  description: integration.description || "",
  status: integration.status,
  endpoint: integration.endpoint || "",
  notes: integration.notes || "",
});

export function IntegrationsPage() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const selectedIdRef = useRef("");
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    const loadIntegrations = async () => {
      try {
        const { data } = await api.get("/integrations");
        const nextItems = data.items;
        const preserved =
          nextItems.find((item) => item.id === selectedIdRef.current) ||
          nextItems[0] ||
          null;

        setItems(nextItems);
        selectedIdRef.current = preserved?.id || "";
        setSelectedId(preserved?.id || "");
        setForm(preserved ? mapIntegrationToForm(preserved) : defaultForm);
      } catch (error) {
        showToast({
          title: t("integrations.loadFailed"),
          description: error.message,
          tone: "error",
        });
      }
    };

    if (user.role === "ADMIN") {
      loadIntegrations();
    }
  }, [reloadKey, showToast, t, user.role]);

  const selectedIntegration = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  );

  if (user.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  const handleSelect = (integration) => {
    selectedIdRef.current = integration.id;
    setSelectedId(integration.id);
    setForm(mapIntegrationToForm(integration));
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();

    try {
      if (selectedIntegration) {
        await api.patch(`/integrations/${selectedIntegration.id}`, form);
      } else {
        await api.post("/integrations", form);
      }

      showToast({
        title: t("integrations.saved"),
        description: t("integrations.savedDescription"),
        tone: "success",
      });
      setReloadKey((value) => value + 1);
    } catch (error) {
      showToast({
        title: t("integrations.saveFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  const handleCreateNew = () => {
    selectedIdRef.current = "";
    setSelectedId("");
    setForm(defaultForm);
  };

  const handleSync = async (integrationId) => {
    try {
      await api.post(`/integrations/${integrationId}/sync`);
      showToast({
        title: t("integrations.synced"),
        description: t("integrations.syncedDescription"),
        tone: "success",
      });
      setReloadKey((value) => value + 1);
    } catch (error) {
      showToast({
        title: t("integrations.syncFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  return (
    <div className="stack-xl">
      <PageHeader
        title={t("integrations.title")}
        description={t("integrations.description")}
        action={
          <button type="button" className="button button--secondary" onClick={handleCreateNew}>
            {t("integrations.newIntegration")}
          </button>
        }
      />

      <section className="two-column">
        <article className="panel stack-lg">
          <div className="panel__header">
            <div>
              <h2>{t("integrations.registryTitle")}</h2>
              <p>{t("integrations.registryDescription")}</p>
            </div>
            <Link2 size={18} />
          </div>

          {items.length ? (
            <div className="stack-md">
              {items.map((integration) => (
                <div className="integration-card" key={integration.id}>
                  <button
                    type="button"
                    className={
                      integration.id === selectedId
                        ? "journal-entry-card journal-entry-card--active"
                        : "journal-entry-card"
                    }
                    onClick={() => handleSelect(integration)}
                  >
                    <div className="journal-entry-card__head">
                      <strong>{integration.name}</strong>
                      <StatusBadge status={integration.status} />
                    </div>
                    <span>{t(`integrations.types.${integration.type}`)}</span>
                    <div className="journal-entry-card__meta">
                      <span>{integration.endpoint || t("integrations.noEndpoint")}</span>
                      <span>
                        {integration.lastSyncAt
                          ? formatDateTime(integration.lastSyncAt, locale)
                          : t("integrations.noSync")}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => handleSync(integration.id)}
                  >
                    <RefreshCcw size={16} />
                    {t("integrations.syncNow")}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">{t("integrations.empty")}</div>
          )}
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <h2>{t("integrations.editorTitle")}</h2>
              <p>{t("integrations.editorDescription")}</p>
            </div>
          </div>

          <form className="stack-md" onSubmit={handleSave}>
            <div className="form-grid">
              <label className="field">
                <span>{t("integrations.typeLabel")}</span>
                <select name="type" value={form.type} onChange={handleFieldChange}>
                  <option value="SCHOOL_SYSTEM">{t("integrations.types.SCHOOL_SYSTEM")}</option>
                  <option value="EDUCATION_PLATFORM">
                    {t("integrations.types.EDUCATION_PLATFORM")}
                  </option>
                  <option value="SUBSIDY_PROGRAM">
                    {t("integrations.types.SUBSIDY_PROGRAM")}
                  </option>
                </select>
              </label>
              <label className="field">
                <span>{t("integrations.statusLabel")}</span>
                <select name="status" value={form.status} onChange={handleFieldChange}>
                  <option value="PLANNED">{t("statuses.PLANNED")}</option>
                  <option value="ACTIVE">{t("statuses.ACTIVE")}</option>
                  <option value="PAUSED">{t("statuses.PAUSED")}</option>
                  <option value="ERROR">{t("statuses.ERROR")}</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>{t("integrations.nameLabel")}</span>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleFieldChange}
                required
              />
            </label>

            <label className="field">
              <span>{t("integrations.endpointLabel")}</span>
              <input
                type="url"
                name="endpoint"
                value={form.endpoint}
                onChange={handleFieldChange}
                placeholder="https://example.local/api"
              />
            </label>

            <label className="field">
              <span>{t("integrations.descriptionLabel")}</span>
              <textarea
                rows="3"
                name="description"
                value={form.description}
                onChange={handleFieldChange}
              />
            </label>

            <label className="field">
              <span>{t("integrations.notesLabel")}</span>
              <textarea rows="4" name="notes" value={form.notes} onChange={handleFieldChange} />
            </label>

            <button type="submit" className="button button--primary">
              {t("integrations.saveIntegration")}
            </button>
          </form>
        </article>
      </section>
    </div>
  );
}
