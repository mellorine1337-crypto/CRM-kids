import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import { Modal } from "../components/Modal.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import {
  formatCurrency,
  formatDate,
  formatGender,
  resolveAssetUrl,
} from "../utils/format.js";

const emptyForm = {
  parentId: "",
  fullName: "",
  birthDate: "",
  gender: "",
  medicalNotes: "",
};

export function ChildrenPage() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [children, setChildren] = useState([]);
  const [parents, setParents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onlyDebtors, setOnlyDebtors] = useState(false);
  const canManage = user.role === "ADMIN";

  const loadChildren = async () => {
    try {
      const { data } = await api.get("/children");
      setChildren(data.items);
    } catch (error) {
      showToast({
        title: t("children.loadFailed"),
        description: error.message,
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user.role === "TEACHER") {
      return;
    }

    const bootstrap = async () => {
      try {
        const requests = [api.get("/children")];

        if (user.role === "ADMIN") {
          requests.push(api.get("/users/parents"));
        }

        const [childrenResponse, parentsResponse] = await Promise.all(requests);
        setChildren(childrenResponse.data.items);
        setParents(parentsResponse?.data?.items || []);
      } catch (error) {
        showToast({
          title: t("children.loadFailed"),
          description: error.message,
          tone: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [showToast, t, user.role]);

  useEffect(() => {
    if (searchParams.get("mode") !== "create" || !canManage) {
      return;
    }

    // Открытие модалки переносится в следующую задачу event loop, чтобы React не считал этот effect каскадным перерендером.
    const timerId = window.setTimeout(() => {
      setEditingChild(null);
      setForm({
        ...emptyForm,
        parentId: user.role === "ADMIN" ? parents[0]?.id || "" : "",
      });
      setFile(null);
      setModalOpen(true);
    }, 0);

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("mode");
      return next;
    });

    return () => {
      window.clearTimeout(timerId);
    };
  }, [canManage, parents, searchParams, setSearchParams, user.role]);

  const resetModal = () => {
    setEditingChild(null);
    setForm(emptyForm);
    setFile(null);
    setModalOpen(false);
  };

  const openCreate = () => {
    setEditingChild(null);
    setForm({
      ...emptyForm,
      parentId: user.role === "ADMIN" ? parents[0]?.id || "" : "",
    });
    setFile(null);
    setModalOpen(true);
  };

  const openEdit = (child) => {
    setEditingChild(child);
    setForm({
      parentId: child.parentId || "",
      fullName: child.fullName,
      birthDate: child.birthDate.slice(0, 10),
      gender: child.gender || "",
      medicalNotes: child.medicalNotes || "",
    });
    setFile(null);
    setModalOpen(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const uploadAvatar = async (childId) => {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    await api.post(`/uploads/children/${childId}/avatar`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      if (user.role === "ADMIN" && !form.parentId) {
        showToast({
          title: t("children.saveFailed"),
          description: t("children.parentRequired"),
          tone: "error",
        });
        return;
      }

      const payload = {
        parentId: user.role === "ADMIN" ? form.parentId : undefined,
        fullName: form.fullName,
        birthDate: new Date(form.birthDate).toISOString(),
        gender: form.gender || undefined,
        medicalNotes: form.medicalNotes || undefined,
      };

      const response = editingChild
        ? await api.patch(`/children/${editingChild.id}`, payload)
        : await api.post("/children", payload);

      const child = response.data.child;
      await uploadAvatar(child.id);
      await loadChildren();
      resetModal();

      showToast({
        title: editingChild ? t("children.updated") : t("children.created"),
        description: t("children.saved", { name: child.fullName }),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("children.saveFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  const handleDelete = async (child) => {
    if (!window.confirm(t("children.deleteConfirm", { name: child.fullName }))) {
      return;
    }

    try {
      await api.delete(`/children/${child.id}`);
      await loadChildren();
      showToast({
        title: t("children.removed"),
        description: t("children.removedDescription", { name: child.fullName }),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("children.deleteFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  const filteredChildren = onlyDebtors
    ? children.filter((child) => Number(child.financials?.debt || 0) > 0)
    : children;

  if (user.role === "TEACHER") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="stack-xl">
      <PageHeader
        title={t("children.title")}
        description={t("children.description")}
        action={
          canManage ? (
            <button
              type="button"
              className="button button--primary"
              onClick={openCreate}
            >
              <Plus size={16} />
              {t("children.addChild")}
            </button>
          ) : null
        }
      />

      <div className="row-actions">
        <button
          type="button"
          className={onlyDebtors ? "button button--primary" : "button button--secondary"}
          onClick={() => setOnlyDebtors((current) => !current)}
        >
          {t("children.onlyDebtors")}
        </button>
      </div>

      {loading ? (
        <div className="empty-state">{t("children.loading")}</div>
      ) : filteredChildren.length ? (
        <section className="card-grid">
          {filteredChildren.map((child) => {
            const photo = resolveAssetUrl(child.profileImageUrl);
            return (
              <article className="child-card" key={child.id}>
                <div className="child-card__header">
                  {photo ? (
                    <img
                      src={photo}
                      alt={child.fullName}
                      className="child-card__photo"
                    />
                  ) : (
                    <div className="child-card__photo child-card__photo--placeholder">
                      {child.fullName[0]}
                    </div>
                  )}
                  <div>
                    <strong>{child.fullName}</strong>
                    <span>{t("children.ageYears", { age: child.age })}</span>
                    <span>{formatDate(child.birthDate, locale)}</span>
                  </div>
                </div>
                <div className="child-card__meta">
                  <span>
                    {t("children.genderLabel")}:{" "}
                    {formatGender(child.gender, locale) || t("children.noGender")}
                  </span>
                  <span>
                    {t("children.notesLabel")}:{" "}
                    {child.medicalNotes || t("children.noNotes")}
                  </span>
                  {child.parent ? (
                    <span>
                      {t("children.parentLabel")}: {child.parent.fullName}
                    </span>
                  ) : null}
                </div>
                <div className="detail-grid">
                  <div className="detail-card">
                    <span>{t("children.accrued")}</span>
                    <strong>
                      {formatCurrency(child.financials?.accrued || 0, "kzt", locale)}
                    </strong>
                  </div>
                  <div className="detail-card">
                    <span>{t("children.paid")}</span>
                    <strong>
                      {formatCurrency(child.financials?.paid || 0, "kzt", locale)}
                    </strong>
                  </div>
                  <div className="detail-card">
                    <span>{t("children.debt")}</span>
                    <strong>
                      {formatCurrency(child.financials?.debt || 0, "kzt", locale)}
                    </strong>
                  </div>
                  <div className="detail-card">
                    <span>{t("children.financeStatus")}</span>
                    <StatusBadge status={child.financials?.balanceStatus || "PENDING"} />
                  </div>
                </div>
                <div className="row-actions">
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => openEdit(child)}
                      >
                        <Pencil size={16} />
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => handleDelete(child)}
                      >
                        <Trash2 size={16} />
                        {t("common.delete")}
                      </button>
                    </>
                  ) : null}
                  {Number(child.financials?.debt || 0) > 0 ? (
                    <button
                      type="button"
                      className={canManage ? "button button--primary" : "button button--secondary"}
                      onClick={() =>
                        navigate(
                          canManage
                            ? `/payments?mode=accept&childId=${child.id}`
                            : "/payments",
                        )
                      }
                    >
                      {t("children.payAction")}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="empty-state">{t("children.empty")}</div>
      )}

      <Modal
        open={modalOpen}
        title={editingChild ? t("children.modalEdit") : t("children.modalAdd")}
        onClose={resetModal}
      >
        <form className="stack-lg" onSubmit={handleSubmit}>
          {user.role === "ADMIN" ? (
            <label className="field">
              <span>{t("children.parentLabel")}</span>
              <select
                name="parentId"
                value={form.parentId}
                onChange={handleChange}
                required
              >
                <option value="">{t("children.selectParent")}</option>
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.fullName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field">
            <span>{t("children.fullName")}</span>
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              required
            />
          </label>
          <label className="field">
            <span>{t("children.birthDate")}</span>
            <input
              type="date"
              name="birthDate"
              value={form.birthDate}
              onChange={handleChange}
              required
            />
          </label>
          <label className="field">
            <span>{t("children.gender")}</span>
            <select name="gender" value={form.gender} onChange={handleChange}>
              <option value="">{t("children.unspecified")}</option>
              <option value="MALE">{t("children.male")}</option>
              <option value="FEMALE">{t("children.female")}</option>
              <option value="OTHER">{t("children.other")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("children.medicalNotes")}</span>
            <textarea
              name="medicalNotes"
              value={form.medicalNotes}
              onChange={handleChange}
              rows="4"
            />
          </label>
          <label className="field">
            <span>{t("children.profilePhoto")}</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>

          <div className="row-actions">
            <button type="submit" className="button button--primary">
              <Upload size={16} />
              {t("children.saveChild")}
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={resetModal}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
