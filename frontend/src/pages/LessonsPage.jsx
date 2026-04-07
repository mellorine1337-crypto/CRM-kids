import { Pencil, Plus, Trash2 } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { Modal } from "../components/Modal.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import { formatCurrency, formatDate } from "../utils/format.js";

const emptyLesson = {
  title: "",
  description: "",
  ageMin: 4,
  ageMax: 8,
  date: "",
  startTime: "10:00",
  endTime: "11:00",
  capacity: 10,
  teacherName: "",
  price: 5000,
};

export function LessonsPage() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const [lessons, setLessons] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedChildren, setSelectedChildren] = useState({});
  const [filters, setFilters] = useState({
    title: "",
    age: "",
    date: "",
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [form, setForm] = useState(emptyLesson);
  const deferredTitle = useDeferredValue(filters.title);
  const canManage = user.role !== "PARENT";

  const fetchLessons = async () => {
    try {
      const params = {};

      if (filters.age) {
        params.age = Number(filters.age);
      }

      if (filters.date) {
        params.date = filters.date;
      }

      if (deferredTitle) {
        params.title = deferredTitle;
      }

      const { data } = await api.get("/lessons", { params });
      setLessons(data.items);
    } catch (error) {
      showToast({
        title: t("lessons.loadFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const params = {};

        if (filters.age) {
          params.age = Number(filters.age);
        }

        if (filters.date) {
          params.date = filters.date;
        }

        if (deferredTitle) {
          params.title = deferredTitle;
        }

        const { data } = await api.get("/lessons", { params });
        setLessons(data.items);
      } catch (error) {
        showToast({
          title: t("lessons.loadFailed"),
          description: error.message,
          tone: "error",
        });
      }
    };

    bootstrap();
  }, [deferredTitle, filters.age, filters.date, showToast, t]);

  useEffect(() => {
    if (user.role !== "PARENT") {
      return;
    }

    const fetchChildren = async () => {
      try {
        const { data } = await api.get("/children");
        setChildren(data.items);
      } catch (error) {
        showToast({
          title: t("children.loadFailed"),
          description: error.message,
          tone: "error",
        });
      }
    };

    fetchChildren();
  }, [showToast, t, user.role]);

  const filteredLessons = useMemo(() => lessons, [lessons]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const openCreate = () => {
    setEditingLesson(null);
    setForm(emptyLesson);
    setModalOpen(true);
  };

  const openEdit = (lesson) => {
    setEditingLesson(lesson);
    setForm({
      title: lesson.title,
      description: lesson.description || "",
      ageMin: lesson.ageMin,
      ageMax: lesson.ageMax,
      date: lesson.date.slice(0, 10),
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      capacity: lesson.capacity,
      teacherName: lesson.teacherName,
      price: lesson.price,
    });
    setModalOpen(true);
  };

  const resetModal = () => {
    setEditingLesson(null);
    setForm(emptyLesson);
    setModalOpen(false);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSaveLesson = async (event) => {
    event.preventDefault();

    try {
      const payload = {
        ...form,
        ageMin: Number(form.ageMin),
        ageMax: Number(form.ageMax),
        capacity: Number(form.capacity),
        price: Number(form.price),
        date: new Date(form.date).toISOString(),
      };

      if (editingLesson) {
        await api.patch(`/lessons/${editingLesson.id}`, payload);
      } else {
        await api.post("/lessons", payload);
      }

      await fetchLessons();
      resetModal();
      showToast({
        title: editingLesson
          ? t("lessons.savedUpdated")
          : t("lessons.savedCreated"),
        description: t("lessons.savedDescription", { name: form.title }),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("lessons.saveFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  const handleDeleteLesson = async (lesson) => {
    if (!window.confirm(t("lessons.deleteConfirm", { name: lesson.title }))) {
      return;
    }

    try {
      await api.delete(`/lessons/${lesson.id}`);
      await fetchLessons();
      showToast({
        title: t("lessons.removed"),
        description: t("lessons.removedDescription", { name: lesson.title }),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("lessons.deleteFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  const handleBookLesson = async (lessonId) => {
    const childId = selectedChildren[lessonId] || children[0]?.id;

    if (!childId) {
      showToast({
        title: t("lessons.addChildFirst"),
        description: t("lessons.addChildFirstDescription"),
        tone: "error",
      });
      return;
    }

    try {
      await api.post("/enrollments", { childId, lessonId });
      showToast({
        title: t("lessons.enrollmentConfirmed"),
        description: t("lessons.enrollmentConfirmedDescription"),
        tone: "success",
      });
      await fetchLessons();
    } catch (error) {
      showToast({
        title: t("lessons.bookingFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  return (
    <div className="stack-xl">
      <PageHeader
        title={t("lessons.title")}
        description={t("lessons.description")}
        action={
          canManage ? (
            <button
              type="button"
              className="button button--primary"
              onClick={openCreate}
            >
              <Plus size={16} />
              {t("lessons.newLesson")}
            </button>
          ) : null
        }
      />

      <section className="filters-bar">
        <label className="field field--compact">
          <span>{t("lessons.search")}</span>
          <input
            name="title"
            value={filters.title}
            onChange={handleFilterChange}
            placeholder={t("lessons.searchPlaceholder")}
          />
        </label>
        <label className="field field--compact">
          <span>{t("lessons.age")}</span>
          <input
            type="number"
            min="0"
            max="18"
            name="age"
            value={filters.age}
            onChange={handleFilterChange}
            placeholder="6"
          />
        </label>
        <label className="field field--compact">
          <span>{t("lessons.date")}</span>
          <input
            type="date"
            name="date"
            value={filters.date}
            onChange={handleFilterChange}
          />
        </label>
      </section>

      <section className="card-grid">
        {filteredLessons.map((lesson) => (
          <article className="lesson-card" key={lesson.id}>
            <div className="lesson-card__head">
              <div>
                <h2>{lesson.title}</h2>
                <p>{lesson.description || t("lessons.noDescription")}</p>
              </div>
              <span className="lesson-card__price">
                {formatCurrency(lesson.price, lesson.currency || "KZT", locale)}
              </span>
            </div>
            <div className="lesson-card__meta">
              <span>{formatDate(lesson.date, locale)}</span>
              <span>
                {lesson.startTime} - {lesson.endTime}
              </span>
              <span>
                {t("lessons.ageRange", {
                  min: lesson.ageMin,
                  max: lesson.ageMax,
                })}
              </span>
              <span>{t("lessons.teacher", { name: lesson.teacherName })}</span>
              <span>
                {t("lessons.seatsLeft", {
                  available: lesson.availableSpots,
                  capacity: lesson.capacity,
                })}
              </span>
            </div>

            {user.role === "PARENT" ? (
              <div className="booking-box">
                <select
                  value={selectedChildren[lesson.id] || children[0]?.id || ""}
                  onChange={(event) =>
                    setSelectedChildren((current) => ({
                      ...current,
                      [lesson.id]: event.target.value,
                    }))
                  }
                >
                  {children.map((child) => (
                    <option value={child.id} key={child.id}>
                      {child.fullName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => handleBookLesson(lesson.id)}
                >
                  {t("lessons.bookLesson")}
                </button>
              </div>
            ) : (
              <div className="row-actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => openEdit(lesson)}
                >
                  <Pencil size={16} />
                  {t("common.edit")}
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => handleDeleteLesson(lesson)}
                >
                  <Trash2 size={16} />
                  {t("common.delete")}
                </button>
              </div>
            )}
          </article>
        ))}
      </section>

      <Modal
        open={modalOpen}
        title={editingLesson ? t("lessons.editModal") : t("lessons.createModal")}
        onClose={resetModal}
      >
        <form className="stack-lg" onSubmit={handleSaveLesson}>
          <label className="field">
            <span>{t("lessons.titleField")}</span>
            <input
              name="title"
              value={form.title}
              onChange={handleFormChange}
              required
            />
          </label>
          <label className="field">
            <span>{t("lessons.descriptionField")}</span>
            <textarea
              name="description"
              value={form.description}
              onChange={handleFormChange}
              rows="4"
            />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>{t("lessons.ageMin")}</span>
              <input
                type="number"
                name="ageMin"
                value={form.ageMin}
                onChange={handleFormChange}
                required
              />
            </label>
            <label className="field">
              <span>{t("lessons.ageMax")}</span>
              <input
                type="number"
                name="ageMax"
                value={form.ageMax}
                onChange={handleFormChange}
                required
              />
            </label>
            <label className="field">
              <span>{t("lessons.date")}</span>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleFormChange}
                required
              />
            </label>
            <label className="field">
              <span>{t("lessons.capacity")}</span>
              <input
                type="number"
                name="capacity"
                value={form.capacity}
                onChange={handleFormChange}
                required
              />
            </label>
            <label className="field">
              <span>{t("lessons.startTime")}</span>
              <input
                type="time"
                name="startTime"
                value={form.startTime}
                onChange={handleFormChange}
                required
              />
            </label>
            <label className="field">
              <span>{t("lessons.endTime")}</span>
              <input
                type="time"
                name="endTime"
                value={form.endTime}
                onChange={handleFormChange}
                required
              />
            </label>
            <label className="field">
              <span>{t("lessons.teacherField")}</span>
              <input
                name="teacherName"
                value={form.teacherName}
                onChange={handleFormChange}
                required
              />
            </label>
            <label className="field">
              <span>{t("lessons.price")}</span>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleFormChange}
                required
              />
            </label>
          </div>
          <div className="row-actions">
            <button type="submit" className="button button--primary">
              {t("lessons.saveLesson")}
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
