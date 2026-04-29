import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import { Modal } from "../components/Modal.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { LOCALE_CODE_MAP } from "../i18n/config.js";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import { formatCurrency, formatDate } from "../utils/format.js";
import { compareLessonDateTime, isFutureOrTodayLesson } from "../utils/schedule.js";

const emptyLesson = {
  title: "",
  description: "",
  ageMin: 4,
  ageMax: 8,
  date: "",
  startTime: "10:00",
  endTime: "11:00",
  capacity: 10,
  teacherId: "",
  teacherName: "",
  price: 5000,
};

const addDays = (date, days) => {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const startOfWeek = (date) => {
  const value = new Date(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  value.setHours(0, 0, 0, 0);
  return value;
};

const isSameDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const getDateKey = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getLessonAccent = (lesson) => {
  const source = `${lesson.teacherName}-${lesson.title}`;
  const hash = Array.from(source).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const hue = hash % 360;
  return {
    "--lesson-accent": `hsl(${hue} 78% 58%)`,
  };
};

const createParentPreviewLesson = (enrollment) => ({
  ...enrollment.lesson,
  childName: enrollment.child?.fullName,
  scheduleStatus: enrollment.attendance?.status || enrollment.status,
  enrollmentId: enrollment.id,
  canShowQr: enrollment.status === "BOOKED" && isFutureOrTodayLesson(enrollment),
  canCancel: enrollment.status === "BOOKED" && isFutureOrTodayLesson(enrollment),
});

const getParentScheduleTone = (status) => {
  if (status === "PRESENT" || status === "ATTENDED") {
    return "success";
  }

  if (status === "ABSENT" || status === "MISSED") {
    return "danger";
  }

  return "planned";
};

const requestLessons = async ({ title, age, date }) => {
  const params = {};

  if (age) {
    params.age = Number(age);
  }

  if (date) {
    params.date = date;
  }

  if (title) {
    params.title = title;
  }

  const { data } = await api.get("/lessons", { params });
  return data.items;
};

export function LessonsPage() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lessons, setLessons] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [parentEnrollments, setParentEnrollments] = useState([]);
  const [filters, setFilters] = useState({
    title: "",
    age: "",
    date: "",
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [previewLesson, setPreviewLesson] = useState(null);
  const [form, setForm] = useState(emptyLesson);
  const [viewMode, setViewMode] = useState("month");
  const [cursorDate, setCursorDate] = useState(new Date());
  const deferredTitle = useDeferredValue(filters.title);
  const canManage = user.role === "ADMIN";
  const localeCode = LOCALE_CODE_MAP[locale] || LOCALE_CODE_MAP.ru;

  const refreshLessons = useCallback(async () => {
    try {
      const items = await requestLessons({
        title: deferredTitle,
        age: filters.age,
        date: filters.date,
      });

      startTransition(() => {
        setLessons(items);
      });
    } catch (error) {
      showToast({
        title: t("lessons.loadFailed"),
        description: error.message,
        tone: "error",
      });
    }
  }, [deferredTitle, filters.age, filters.date, showToast, t]);

  useEffect(() => {
    if (user.role === "PARENT") {
      return;
    }

    let cancelled = false;

    const syncLessons = async () => {
      try {
        const [items, teachersResponse] = await Promise.all([
          requestLessons({
            title: deferredTitle,
            age: filters.age,
            date: filters.date,
          }),
          user.role === "ADMIN"
            ? api.get("/users/teachers")
            : Promise.resolve({ data: { items: [] } }),
        ]);

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setLessons(items);
          setTeachers(teachersResponse.data.items);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        showToast({
          title: t("lessons.loadFailed"),
          description: error.message,
          tone: "error",
        });
      }
    };

    void syncLessons();

    return () => {
      cancelled = true;
    };
  }, [deferredTitle, filters.age, filters.date, showToast, t, user.role]);

  useEffect(() => {
    if (user.role !== "PARENT") {
      return;
    }

    const fetchParentSchedule = async () => {
      try {
        const { data } = await api.get("/enrollments/my");
        setParentEnrollments(data.items);
      } catch (error) {
        showToast({
          title: t("lessons.loadFailed"),
          description: error.message,
          tone: "error",
        });
      }
    };

    fetchParentSchedule();
  }, [showToast, t, user.role]);

  useEffect(() => {
    if (searchParams.get("mode") !== "create" || !canManage) {
      return;
    }

    startTransition(() => {
      setEditingLesson(null);
      setForm(emptyLesson);
      setModalOpen(true);
    });
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("mode");
      return next;
    });
  }, [canManage, searchParams, setSearchParams]);

  const sortedLessons = useMemo(
    () =>
      [...lessons].sort((left, right) => {
        const leftDate = new Date(left.date);
        const rightDate = new Date(right.date);

        if (leftDate.getTime() !== rightDate.getTime()) {
          return leftDate - rightDate;
        }

        return left.startTime.localeCompare(right.startTime);
      }),
    [lessons],
  );

  const lessonsByDay = useMemo(() => {
    const buckets = new Map();

    for (const lesson of sortedLessons) {
      const key = getDateKey(lesson.date);
      const current = buckets.get(key) || [];
      current.push(lesson);
      buckets.set(key, current);
    }

    return buckets;
  }, [sortedLessons]);

  const monthStart = useMemo(() => startOfMonth(cursorDate), [cursorDate]);
  const monthGridStart = useMemo(() => startOfWeek(monthStart), [monthStart]);
  const monthDays = useMemo(
    () => Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index)),
    [monthGridStart],
  );

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursorDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [cursorDate]);

  const dayLessons = useMemo(
    () => lessonsByDay.get(getDateKey(cursorDate)) || [],
    [cursorDate, lessonsByDay],
  );

  const parentSchedule = useMemo(
    () =>
      parentEnrollments
        .filter(
          (enrollment) =>
            enrollment.lesson && enrollment.status !== "CANCELLED",
        )
        .sort(compareLessonDateTime),
    [parentEnrollments],
  );

  const parentLessonsByDay = useMemo(() => {
    const buckets = new Map();

    for (const enrollment of parentSchedule) {
      const key = getDateKey(enrollment.lesson.date);
      const current = buckets.get(key) || [];
      current.push(enrollment);
      buckets.set(key, current);
    }

    return buckets;
  }, [parentSchedule]);

  const parentDayEnrollments = useMemo(
    () => parentLessonsByDay.get(getDateKey(cursorDate)) || [],
    [cursorDate, parentLessonsByDay],
  );

  const weekFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCode, {
        weekday: "short",
      }),
    [localeCode],
  );

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCode, {
        month: "long",
        year: "numeric",
      }).format(cursorDate),
    [cursorDate, localeCode],
  );

  const toolbarTitle = useMemo(() => {
    if (viewMode === "month") {
      return monthTitle;
    }

    if (viewMode === "week") {
      return `${formatDate(weekDays[0], locale)} - ${formatDate(weekDays[6], locale)}`;
    }

    return formatDate(cursorDate, locale);
  }, [cursorDate, locale, monthTitle, viewMode, weekDays]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));

    if (name === "date" && value) {
      setCursorDate(new Date(`${value}T12:00:00`));
    }
  };

  const openCreate = () => {
    setEditingLesson(null);
    setForm({
      ...emptyLesson,
      teacherId: teachers[0]?.id || "",
      teacherName: teachers[0]?.fullName || "",
    });
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
      teacherId: lesson.teacherId || "",
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
    if (name === "teacherId") {
      const selectedTeacher = teachers.find((teacher) => teacher.id === value);
      setForm((current) => ({
        ...current,
        teacherId: value,
        teacherName: selectedTeacher?.fullName || "",
      }));
      return;
    }

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
        teacherId: form.teacherId || undefined,
        date: new Date(form.date).toISOString(),
      };

      if (editingLesson) {
        await api.patch(`/lessons/${editingLesson.id}`, payload);
      } else {
        await api.post("/lessons", payload);
      }

      await refreshLessons();
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
      setPreviewLesson(null);
      await refreshLessons();
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

  const handleCancelEnrollment = async (enrollmentId) => {
    try {
      await api.patch(`/enrollments/${enrollmentId}/cancel`);
      setParentEnrollments((current) =>
        current.map((enrollment) =>
          enrollment.id === enrollmentId
            ? { ...enrollment, status: "CANCELLED" }
            : enrollment,
        ),
      );
      setPreviewLesson(null);
      showToast({
        title: t("enrollments.cancelled"),
        description: t("lessons.parentCancelledDescription"),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("enrollments.cancelFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  const navigatePeriod = (direction) => {
    setCursorDate((current) => {
      if (viewMode === "month") {
        return new Date(current.getFullYear(), current.getMonth() + direction, 1);
      }

      if (viewMode === "week") {
        return addDays(current, 7 * direction);
      }

      return addDays(current, direction);
    });
  };

  const handleMoreDay = (date) => {
    setCursorDate(date);
    setViewMode("day");
  };

  const renderLessonEntry = (lesson) => (
    <button
      key={lesson.id}
      type="button"
      className="schedule-entry"
      style={getLessonAccent(lesson)}
      onClick={() => setPreviewLesson(lesson)}
      title={`${lesson.startTime} ${lesson.title}`}
    >
      <span className="schedule-entry__dot" />
      <span className="schedule-entry__time">{lesson.startTime}</span>
      <span className="schedule-entry__title">{lesson.title}</span>
      <span className="schedule-entry__count">
        {`${lesson.capacity - lesson.availableSpots}/${lesson.capacity}`}
      </span>
    </button>
  );

  const renderParentLessonEntry = (enrollment) => {
    const lesson = enrollment.lesson;
    const childShortName = enrollment.child?.fullName?.split(" ")[0] || "";

    return (
      <button
        key={enrollment.id}
        type="button"
        className={`schedule-entry schedule-entry--${getParentScheduleTone(enrollment.attendance?.status || enrollment.status)}`}
        onClick={() => setPreviewLesson(createParentPreviewLesson(enrollment))}
        title={`${lesson.startTime} ${lesson.title}`}
      >
        <span className="schedule-entry__dot" />
        <span className="schedule-entry__time">{lesson.startTime}</span>
        <span className="schedule-entry__title">{childShortName}</span>
        <span className="schedule-entry__count">{lesson.title}</span>
      </button>
    );
  };

  if (user.role === "PARENT") {
    return (
      <div className="stack-xl">
        <PageHeader title={t("lessons.parentTitle")} />

        <section className="panel schedule-panel">
          <div className="schedule-toolbar">
            <div className="schedule-toolbar__nav">
              <button
                type="button"
                className="button button--primary"
                onClick={() => navigatePeriod(-1)}
              >
                <ChevronLeft size={16} />
                {t("lessons.prev")}
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  setCursorDate(new Date());
                  setViewMode("day");
                }}
              >
                {t("lessons.today")}
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => navigatePeriod(1)}
              >
                {t("lessons.next")}
                <ChevronRight size={16} />
              </button>
            </div>

            <strong className="schedule-toolbar__title">{toolbarTitle}</strong>

            <div className="schedule-toolbar__views">
              {["month", "day"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={
                    viewMode === mode
                      ? "button button--primary"
                      : "button button--secondary"
                  }
                  onClick={() => {
                    setViewMode(mode);

                    if (mode === "day") {
                      setCursorDate(new Date());
                    }
                  }}
                >
                  {t(`lessons.view${mode.charAt(0).toUpperCase()}${mode.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>

          {parentSchedule.length ? (
            <>
              {viewMode === "month" ? (
                <div className="schedule-calendar">
                  <div className="schedule-weekdays">
                    {weekDays.map((day) => (
                      <div className="schedule-weekdays__item" key={day.toISOString()}>
                        {weekFormatter.format(day).replace(".", "")}
                      </div>
                    ))}
                  </div>

                  <div className="schedule-grid">
                    {monthDays.map((day) => {
                      const dayKey = getDateKey(day);
                      const dayEnrollments = parentLessonsByDay.get(dayKey) || [];
                      const visibleEnrollments = dayEnrollments.slice(0, 4);
                      const hiddenCount = Math.max(dayEnrollments.length - visibleEnrollments.length, 0);

                      return (
                        <article
                          key={dayKey}
                          className={[
                            "schedule-cell",
                            day.getMonth() !== cursorDate.getMonth() ? "schedule-cell--muted" : "",
                            isSameDay(day, new Date()) ? "schedule-cell--today" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <div className="schedule-cell__head">
                            <button
                              type="button"
                              className="schedule-cell__date"
                              onClick={() => handleMoreDay(day)}
                            >
                              {day.getDate()}
                            </button>
                            {dayEnrollments.length ? <span>{dayEnrollments.length}</span> : null}
                          </div>

                          <div className="schedule-cell__events">
                            {visibleEnrollments.map(renderParentLessonEntry)}
                            {hiddenCount ? (
                              <button
                                type="button"
                                className="schedule-more"
                                onClick={() => handleMoreDay(day)}
                              >
                                {t("lessons.moreItems", { count: hiddenCount })}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {viewMode === "day" ? (
                <div className="schedule-day-view">
                  <div className="schedule-day-view__head">
                    <div>
                      <h2>{formatDate(cursorDate, locale)}</h2>
                      <p>{t("lessons.daySummary", { count: parentDayEnrollments.length })}</p>
                    </div>
                    <CalendarDays size={18} />
                  </div>

                  {parentDayEnrollments.length ? (
                    <div className="schedule-day-view__list">
                      {parentDayEnrollments.map((enrollment) => (
                        <article className="schedule-day-card" key={enrollment.id}>
                          <div className="schedule-day-card__head">
                            <div>
                              <strong>{enrollment.child?.fullName}</strong>
                              <span>
                                {enrollment.lesson.startTime} - {enrollment.lesson.endTime}
                              </span>
                            </div>
                            <StatusBadge
                              status={enrollment.attendance?.status || enrollment.status}
                            />
                          </div>
                          <div className="lesson-card__meta">
                            <span>{enrollment.lesson.title}</span>
                            <span>{enrollment.lesson.teacherName}</span>
                          </div>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="button button--secondary"
                              onClick={() =>
                                setPreviewLesson(createParentPreviewLesson(enrollment))
                              }
                            >
                              {t("lessons.openLesson")}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">{t("lessons.noLessonsForPeriod")}</div>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty-state">{t("lessons.parentEmpty")}</div>
          )}
        </section>
      </div>
    );
  }

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

      <section className="panel schedule-panel">
        <div className="schedule-toolbar">
          <div className="schedule-toolbar__nav">
            <button
              type="button"
              className="button button--primary"
              onClick={() => navigatePeriod(-1)}
            >
              <ChevronLeft size={16} />
              {t("lessons.prev")}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setCursorDate(new Date())}
            >
              {t("lessons.today")}
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={() => navigatePeriod(1)}
            >
              {t("lessons.next")}
              <ChevronRight size={16} />
            </button>
          </div>

          <strong className="schedule-toolbar__title">{toolbarTitle}</strong>

          <div className="schedule-toolbar__views">
            {["month", "week", "day"].map((mode) => (
              <button
                key={mode}
                type="button"
                className={
                  viewMode === mode
                    ? "button button--primary"
                    : "button button--secondary"
                }
                onClick={() => setViewMode(mode)}
              >
                {t(`lessons.view${mode.charAt(0).toUpperCase()}${mode.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>

        {viewMode === "month" ? (
          <div className="schedule-calendar">
            <div className="schedule-weekdays">
              {weekDays.map((day) => (
                <div className="schedule-weekdays__item" key={day.toISOString()}>
                  {weekFormatter.format(day).replace(".", "")}
                </div>
              ))}
            </div>

            <div className="schedule-grid">
              {monthDays.map((day) => {
                const dayKey = getDateKey(day);
                const dayLessonsForCell = lessonsByDay.get(dayKey) || [];
                const visibleLessons = dayLessonsForCell.slice(0, 5);
                const hiddenCount = Math.max(dayLessonsForCell.length - visibleLessons.length, 0);

                return (
                  <article
                    key={dayKey}
                    className={[
                      "schedule-cell",
                      day.getMonth() !== cursorDate.getMonth() ? "schedule-cell--muted" : "",
                      isSameDay(day, new Date()) ? "schedule-cell--today" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="schedule-cell__head">
                      <button
                        type="button"
                        className="schedule-cell__date"
                        onClick={() => handleMoreDay(day)}
                      >
                        {day.getDate()}
                      </button>
                      {dayLessonsForCell.length ? <span>{dayLessonsForCell.length}</span> : null}
                    </div>

                    <div className="schedule-cell__events">
                      {visibleLessons.map(renderLessonEntry)}
                      {hiddenCount ? (
                        <button
                          type="button"
                          className="schedule-more"
                          onClick={() => handleMoreDay(day)}
                        >
                          {t("lessons.moreItems", { count: hiddenCount })}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {viewMode === "week" ? (
          <div className="schedule-week-view">
            {weekDays.map((day) => {
              const lessonsForDay = lessonsByDay.get(getDateKey(day)) || [];

              return (
                <article
                  key={day.toISOString()}
                  className={`schedule-column ${isSameDay(day, new Date()) ? "schedule-column--today" : ""}`}
                >
                  <div className="schedule-column__head">
                    <strong>{weekFormatter.format(day).replace(".", "")}</strong>
                    <span>{formatDate(day, locale)}</span>
                  </div>
                  <div className="schedule-column__body">
                    {lessonsForDay.length ? (
                      lessonsForDay.map(renderLessonEntry)
                    ) : (
                      <div className="empty-state empty-state--compact">
                        {t("lessons.noLessonsForPeriod")}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {viewMode === "day" ? (
          <div className="schedule-day-view">
            <div className="schedule-day-view__head">
              <div>
                <h2>{formatDate(cursorDate, locale)}</h2>
                <p>{t("lessons.daySummary", { count: dayLessons.length })}</p>
              </div>
              <CalendarDays size={18} />
            </div>

            {dayLessons.length ? (
              <div className="schedule-day-view__list">
                {dayLessons.map((lesson) => (
                  <article className="schedule-day-card" key={lesson.id}>
                    <div className="schedule-day-card__head">
                      <div>
                        <strong>{lesson.title}</strong>
                        <span>
                          {lesson.startTime} - {lesson.endTime}
                        </span>
                      </div>
                      <span className="lesson-card__price">
                        {formatCurrency(lesson.price, lesson.currency || "KZT", locale)}
                      </span>
                    </div>
                    <div className="lesson-card__meta">
                      <span>{lesson.description || t("lessons.noDescription")}</span>
                      <span>{t("lessons.teacher", { name: lesson.teacherName })}</span>
                      <span>
                        {t("lessons.ageRange", {
                          min: lesson.ageMin,
                          max: lesson.ageMax,
                        })}
                      </span>
                      <span>
                        {t("lessons.seatsLeft", {
                          available: lesson.availableSpots,
                          capacity: lesson.capacity,
                        })}
                      </span>
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => setPreviewLesson(lesson)}
                      >
                        {t("lessons.openLesson")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">{t("lessons.noLessonsForPeriod")}</div>
            )}
          </div>
        ) : null}
      </section>

      <Modal
        open={Boolean(previewLesson)}
        title={previewLesson?.title || t("lessons.lessonDetails")}
        onClose={() => setPreviewLesson(null)}
      >
            {previewLesson ? (
          <div className="stack-lg">
            <div className="detail-grid">
              {previewLesson.childName ? (
                <div className="detail-card">
                  <span>{t("enrollments.child")}</span>
                  <strong>{previewLesson.childName}</strong>
                </div>
              ) : null}
              {previewLesson.scheduleStatus ? (
                <div className="detail-card">
                  <span>{t("enrollments.status")}</span>
                  <StatusBadge status={previewLesson.scheduleStatus} />
                </div>
              ) : null}
              <div className="detail-card">
                <span>{t("lessons.date")}</span>
                <strong>{formatDate(previewLesson.date, locale)}</strong>
              </div>
              <div className="detail-card">
                <span>{t("lessons.timeLabel")}</span>
                <strong>{`${previewLesson.startTime} - ${previewLesson.endTime}`}</strong>
              </div>
              <div className="detail-card">
                <span>{t("lessons.teacherField")}</span>
                <strong>{previewLesson.teacherName}</strong>
              </div>
              <div className="detail-card">
                <span>{t("lessons.price")}</span>
                <strong>
                  {formatCurrency(previewLesson.price, previewLesson.currency || "KZT", locale)}
                </strong>
              </div>
            </div>

            {previewLesson.description ? (
              <div className="detail-card detail-card--highlight">
                <span>{t("lessons.descriptionField")}</span>
                <p>{previewLesson.description}</p>
              </div>
            ) : null}

            {canManage ? (
              <div className="row-actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => {
                    setPreviewLesson(null);
                    openEdit(previewLesson);
                  }}
                >
                  <Pencil size={16} />
                  {t("common.edit")}
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => handleDeleteLesson(previewLesson)}
                >
                  <Trash2 size={16} />
                  {t("common.delete")}
                </button>
              </div>
            ) : (
              <div className="row-actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() =>
                    navigate(`/attendance?enrollmentId=${previewLesson.enrollmentId}`)
                  }
                  disabled={!previewLesson.canShowQr}
                >
                  <CalendarDays size={16} />
                  {t("lessons.openQr")}
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => navigate("/feedback")}
                >
                  {t("lessons.writeTeacher")}
                </button>
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => handleCancelEnrollment(previewLesson.enrollmentId)}
                  disabled={!previewLesson.canCancel}
                >
                  <Trash2 size={16} />
                  {t("lessons.cancelEnrollment")}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

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
              <select
                name="teacherId"
                value={form.teacherId}
                onChange={handleFormChange}
                required
              >
                <option value="">{t("lessons.selectTeacher")}</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.fullName}
                  </option>
                ))}
              </select>
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
