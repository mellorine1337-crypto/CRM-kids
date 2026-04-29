import { BookOpen, MessageSquareMore, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import { formatDate } from "../utils/format.js";

const defaultJournalForm = {
  enrollmentId: "",
  topicSummary: "",
  homeworkTitle: "",
  homeworkDescription: "",
  homeworkDueDate: "",
  homeworkStatus: "ASSIGNED",
  score: "",
  progressLevel: "GOOD",
  teacherComment: "",
};

const toDateInput = (value) => {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
};

const mapEntryToForm = (entry) => ({
  enrollmentId: entry.enrollmentId,
  topicSummary: entry.topicSummary || "",
  homeworkTitle: entry.homeworkTitle || "",
  homeworkDescription: entry.homeworkDescription || "",
  homeworkDueDate: toDateInput(entry.homeworkDueDate),
  homeworkStatus: entry.homeworkStatus || "ASSIGNED",
  score: typeof entry.score === "number" ? String(entry.score) : "",
  progressLevel: entry.progressLevel || "GOOD",
  teacherComment: entry.teacherComment || "",
});

export function JournalPage() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [entries, setEntries] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const selectedEntryIdRef = useRef("");
  const [journalForm, setJournalForm] = useState(defaultJournalForm);
  const [parentComment, setParentComment] = useState("");

  useEffect(() => {
    const loadJournal = async () => {
      try {
        const [journalResponse, enrollmentResponse] = await Promise.all([
          api.get("/journal"),
          user.role === "TEACHER"
            ? api.get("/enrollments")
            : Promise.resolve({ data: { items: [] } }),
        ]);

        const nextEntries = journalResponse.data.items;
        const nextEnrollments = enrollmentResponse.data.items;
        const preservedEntry =
          nextEntries.find((entry) => entry.id === selectedEntryIdRef.current) ||
          nextEntries[0] ||
          null;

        setEntries(nextEntries);
        setEnrollments(nextEnrollments);
        selectedEntryIdRef.current = preservedEntry?.id || "";
        setSelectedEntryId(preservedEntry?.id || "");

        if (preservedEntry) {
          setJournalForm(mapEntryToForm(preservedEntry));
          setParentComment(preservedEntry.parentComment || "");
        } else {
          setParentComment("");
          setJournalForm((current) => ({
            ...defaultJournalForm,
            enrollmentId: current.enrollmentId || nextEnrollments[0]?.id || "",
          }));
        }
      } catch (error) {
        showToast({
          title: t("journal.loadFailed"),
          description: error.message,
          tone: "error",
        });
      }
    };

    loadJournal();
  }, [reloadKey, showToast, t, user.role]);

  const enrollmentMap = useMemo(
    () => new Map(entries.map((entry) => [entry.enrollmentId, entry])),
    [entries],
  );

  const availableEnrollments = useMemo(
    () =>
      enrollments.filter(
        (enrollment) => enrollment.status !== "CANCELLED" && enrollment.lesson && enrollment.child,
      ),
    [enrollments],
  );

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) || null,
    [entries, selectedEntryId],
  );

  const handleSelectEntry = (entry) => {
    selectedEntryIdRef.current = entry.id;
    setSelectedEntryId(entry.id);
    setJournalForm(mapEntryToForm(entry));
    setParentComment(entry.parentComment || "");
  };

  const handleJournalField = (event) => {
    const { name, value } = event.target;

    if (name === "enrollmentId") {
      const existingEntry = enrollmentMap.get(value);

      if (existingEntry) {
        handleSelectEntry(existingEntry);
        return;
      }

      selectedEntryIdRef.current = "";
      setSelectedEntryId("");
    }

    setJournalForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSaveJournal = async (event) => {
    event.preventDefault();

    try {
      await api.post("/journal", {
        enrollmentId: journalForm.enrollmentId,
        topicSummary: journalForm.topicSummary || undefined,
        homeworkTitle: journalForm.homeworkTitle || undefined,
        homeworkDescription: journalForm.homeworkDescription || undefined,
        homeworkDueDate: journalForm.homeworkDueDate || undefined,
        homeworkStatus: journalForm.homeworkStatus || undefined,
        score: journalForm.score ? Number(journalForm.score) : undefined,
        progressLevel: journalForm.progressLevel || undefined,
        teacherComment: journalForm.teacherComment || undefined,
      });

      showToast({
        title: t("journal.saved"),
        description: t("journal.savedDescription"),
        tone: "success",
      });
      setReloadKey((value) => value + 1);
    } catch (error) {
      showToast({
        title: t("journal.saveFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  const handleSaveParentComment = async (event) => {
    event.preventDefault();

    if (!selectedEntry) {
      return;
    }

    try {
      await api.patch(`/journal/${selectedEntry.id}/parent-comment`, {
        parentComment,
      });

      showToast({
        title: t("journal.commentSaved"),
        description: t("journal.commentSavedDescription"),
        tone: "success",
      });
      setReloadKey((value) => value + 1);
    } catch (error) {
      showToast({
        title: t("journal.commentSaveFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  if (!["TEACHER", "PARENT"].includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="stack-xl">
      <PageHeader title={t("journal.title")} description={t("journal.description")} />

      <section className="journal-layout">
        <article className="panel stack-lg">
          <div className="panel__header">
            <div>
              <h2>{t("journal.entriesTitle")}</h2>
              <p>{t("journal.entriesDescription")}</p>
            </div>
            <BookOpen size={18} />
          </div>

          {entries.length ? (
            <div className="stack-md">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={
                    entry.id === selectedEntryId
                      ? "journal-entry-card journal-entry-card--active"
                      : "journal-entry-card"
                  }
                  onClick={() => handleSelectEntry(entry)}
                >
                  <div className="journal-entry-card__head">
                    <strong>{entry.enrollment?.child?.fullName}</strong>
                    {entry.progressLevel ? <StatusBadge status={entry.progressLevel} /> : null}
                  </div>
                  <span>{entry.enrollment?.lesson?.title}</span>
                  <div className="journal-entry-card__meta">
                    <span>
                      {formatDate(entry.enrollment?.lesson?.date, locale)} •{" "}
                      {entry.enrollment?.lesson?.teacherName}
                    </span>
                    {entry.homeworkStatus ? <StatusBadge status={entry.homeworkStatus} /> : null}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">{t("journal.empty")}</div>
          )}
        </article>

        <div className="stack-lg">
          {selectedEntry ? (
            <article className="panel stack-lg">
              <div className="panel__header">
                <div>
                  <h2>{t("journal.detailTitle")}</h2>
                  <p>{t("journal.detailDescription")}</p>
                </div>
              </div>

              <div className="detail-grid">
                <div className="detail-card">
                  <span>{t("journal.childLabel")}</span>
                  <strong>{selectedEntry.enrollment?.child?.fullName}</strong>
                </div>
                <div className="detail-card">
                  <span>{t("journal.lessonLabel")}</span>
                  <strong>{selectedEntry.enrollment?.lesson?.title}</strong>
                </div>
                <div className="detail-card">
                  <span>{t("journal.scoreLabel")}</span>
                  <strong>
                    {typeof selectedEntry.score === "number"
                      ? selectedEntry.score
                      : t("journal.noScore")}
                  </strong>
                </div>
                <div className="detail-card">
                  <span>{t("journal.dueDateLabel")}</span>
                  <strong>
                    {selectedEntry.homeworkDueDate
                      ? formatDate(selectedEntry.homeworkDueDate, locale)
                      : t("journal.noDueDate")}
                  </strong>
                </div>
              </div>

              <div className="stack-md">
                <div className="detail-card">
                  <span>{t("journal.topicLabel")}</span>
                  <strong>{selectedEntry.topicSummary || t("journal.notFilled")}</strong>
                </div>
                <div className="detail-card">
                  <span>{t("journal.homeworkLabel")}</span>
                  <strong>{selectedEntry.homeworkTitle || t("journal.notFilled")}</strong>
                  <p>{selectedEntry.homeworkDescription || t("journal.notFilled")}</p>
                </div>
                <div className="detail-card">
                  <span>{t("journal.teacherCommentLabel")}</span>
                  <strong>{selectedEntry.teacherComment || t("journal.notFilled")}</strong>
                </div>
                <div className="detail-card">
                  <span>{t("journal.parentCommentLabel")}</span>
                  <strong>{selectedEntry.parentComment || t("journal.notFilled")}</strong>
                </div>
              </div>
            </article>
          ) : null}

          {user.role === "TEACHER" ? (
            <article className="panel">
              <div className="panel__header">
                <div>
                  <h2>{t("journal.editorTitle")}</h2>
                  <p>{t("journal.editorDescription")}</p>
                </div>
              </div>

              <form className="stack-md" onSubmit={handleSaveJournal}>
                <label className="field">
                  <span>{t("journal.enrollmentLabel")}</span>
                  <select
                    name="enrollmentId"
                    value={journalForm.enrollmentId}
                    onChange={handleJournalField}
                    required
                  >
                    <option value="">{t("journal.selectEnrollment")}</option>
                    {availableEnrollments.map((enrollment) => (
                      <option key={enrollment.id} value={enrollment.id}>
                        {`${enrollment.child?.fullName} • ${enrollment.lesson?.title}`}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="form-grid">
                  <label className="field">
                    <span>{t("journal.scoreLabel")}</span>
                    <input
                      type="number"
                      name="score"
                      min="0"
                      max="100"
                      value={journalForm.score}
                      onChange={handleJournalField}
                    />
                  </label>
                  <label className="field">
                    <span>{t("journal.progressLabel")}</span>
                    <select
                      name="progressLevel"
                      value={journalForm.progressLevel}
                      onChange={handleJournalField}
                    >
                      <option value="EXCELLENT">{t("statuses.EXCELLENT")}</option>
                      <option value="GOOD">{t("statuses.GOOD")}</option>
                      <option value="ATTENTION_REQUIRED">
                        {t("statuses.ATTENTION_REQUIRED")}
                      </option>
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span>{t("journal.topicLabel")}</span>
                  <textarea
                    rows="3"
                    name="topicSummary"
                    value={journalForm.topicSummary}
                    onChange={handleJournalField}
                  />
                </label>

                <div className="form-grid">
                  <label className="field">
                    <span>{t("journal.homeworkLabel")}</span>
                    <input
                      type="text"
                      name="homeworkTitle"
                      value={journalForm.homeworkTitle}
                      onChange={handleJournalField}
                    />
                  </label>
                  <label className="field">
                    <span>{t("journal.dueDateLabel")}</span>
                    <input
                      type="date"
                      name="homeworkDueDate"
                      value={journalForm.homeworkDueDate}
                      onChange={handleJournalField}
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>{t("journal.homeworkStatusLabel")}</span>
                    <select
                      name="homeworkStatus"
                      value={journalForm.homeworkStatus}
                      onChange={handleJournalField}
                    >
                      <option value="ASSIGNED">{t("statuses.ASSIGNED")}</option>
                      <option value="SUBMITTED">{t("statuses.SUBMITTED")}</option>
                      <option value="REVIEWED">{t("statuses.REVIEWED")}</option>
                      <option value="OVERDUE">{t("statuses.OVERDUE")}</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>{t("journal.teacherCommentLabel")}</span>
                    <input
                      type="text"
                      name="teacherComment"
                      value={journalForm.teacherComment}
                      onChange={handleJournalField}
                    />
                  </label>
                </div>

                <label className="field">
                  <span>{t("journal.homeworkDescriptionLabel")}</span>
                  <textarea
                    rows="4"
                    name="homeworkDescription"
                    value={journalForm.homeworkDescription}
                    onChange={handleJournalField}
                  />
                </label>

                <button type="submit" className="button button--primary">
                  <Save size={16} />
                  {t("journal.saveJournal")}
                </button>
              </form>
            </article>
          ) : selectedEntry ? (
            <article className="panel">
              <div className="panel__header">
                <div>
                  <h2>{t("journal.parentTitle")}</h2>
                  <p>{t("journal.parentDescription")}</p>
                </div>
                <MessageSquareMore size={18} />
              </div>

              <form className="stack-md" onSubmit={handleSaveParentComment}>
                <label className="field">
                  <span>{t("journal.parentCommentLabel")}</span>
                  <textarea
                    rows="4"
                    value={parentComment}
                    onChange={(event) => setParentComment(event.target.value)}
                    placeholder={t("journal.parentCommentPlaceholder")}
                    required
                  />
                </label>

                <button type="submit" className="button button--primary">
                  <Save size={16} />
                  {t("journal.saveParentComment")}
                </button>
              </form>
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}
