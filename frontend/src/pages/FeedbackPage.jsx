import { MessageSquare, SendHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import { formatDateTime } from "../utils/format.js";

const defaultComposeState = {
  subject: "",
  message: "",
  staffId: "",
  parentId: "",
  childId: "",
};

export function FeedbackPage() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [selectedThread, setSelectedThread] = useState(null);
  const [options, setOptions] = useState({
    staff: [],
    parents: [],
    children: [],
  });
  const [composeForm, setComposeForm] = useState(defaultComposeState);
  const [replyBody, setReplyBody] = useState("");

  const filteredChildren = useMemo(() => {
    if (user.role === "PARENT") {
      return options.children;
    }

    if (!composeForm.parentId) {
      return options.children;
    }

    return options.children.filter((child) => child.parentId === composeForm.parentId);
  }, [composeForm.parentId, options.children, user.role]);

  const openThread = async (threadId) => {
    setSelectedThreadId(threadId);

    if (!threadId) {
      setSelectedThread(null);
      return;
    }

    try {
      const { data } = await api.get(`/feedback/${threadId}`);
      setSelectedThread(data.thread);
    } catch (error) {
      showToast({
        title: t("feedback.loadThreadFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  const loadThreads = async (preferredThreadId) => {
    const { data } = await api.get("/feedback");
    setThreads(data.items);

    const nextThreadId =
      preferredThreadId && data.items.some((thread) => thread.id === preferredThreadId)
        ? preferredThreadId
        : selectedThreadId && data.items.some((thread) => thread.id === selectedThreadId)
          ? selectedThreadId
          : data.items[0]?.id || "";

    setSelectedThreadId(nextThreadId);
    return nextThreadId;
  };

  useEffect(() => {
    if (!["PARENT", "TEACHER"].includes(user.role)) {
      return;
    }

    const bootstrap = async () => {
      try {
        const [optionsResponse, threadsResponse] = await Promise.all([
          api.get("/feedback/options"),
          api.get("/feedback"),
        ]);

        setOptions(optionsResponse.data);
        setThreads(threadsResponse.data.items);
        const nextThreadId = threadsResponse.data.items[0]?.id || "";
        setSelectedThreadId(nextThreadId);
        setSelectedThread(null);

        setComposeForm((current) => ({
          ...current,
          staffId:
            current.staffId ||
            (user.role === "PARENT" ? optionsResponse.data.staff[0]?.id || "" : ""),
          parentId:
            current.parentId ||
            (user.role === "TEACHER" ? optionsResponse.data.parents[0]?.id || "" : ""),
        }));

        if (nextThreadId) {
          const { data } = await api.get(`/feedback/${nextThreadId}`);
          setSelectedThread(data.thread);
        }
      } catch (error) {
        showToast({
          title: t("feedback.loadFailed"),
          description: error.message,
          tone: "error",
        });
      }
    };

    bootstrap();
  }, [showToast, t, user.role]);

  const handleComposeChange = (event) => {
    const { name, value } = event.target;

    setComposeForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "parentId" ? { childId: "" } : {}),
    }));
  };

  const handleCreateThread = async (event) => {
    event.preventDefault();

    try {
      const payload =
        user.role === "PARENT"
          ? {
              subject: composeForm.subject,
              message: composeForm.message,
              staffId: composeForm.staffId,
              childId: composeForm.childId || undefined,
            }
          : {
              subject: composeForm.subject,
              message: composeForm.message,
              parentId: composeForm.parentId,
              childId: composeForm.childId || undefined,
            };

      const { data } = await api.post("/feedback", payload);

      setComposeForm((current) => ({
        ...defaultComposeState,
        staffId: user.role === "PARENT" ? current.staffId : "",
        parentId: user.role === "TEACHER" ? current.parentId : "",
      }));
      setReplyBody("");
      setSelectedThread(data.thread);
      const nextThreadId = await loadThreads(data.thread.id);
      await openThread(nextThreadId);

      showToast({
        title: t("feedback.created"),
        description: t("feedback.createdDescription"),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("feedback.createFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  const handleReply = async (event) => {
    event.preventDefault();

    if (!selectedThread) {
      return;
    }

    try {
      await api.post(`/feedback/${selectedThread.id}/messages`, {
        body: replyBody,
      });

      setReplyBody("");
      const nextThreadId = await loadThreads(selectedThread.id);
      await openThread(nextThreadId);

      showToast({
        title: t("feedback.replySent"),
        description: t("feedback.replySentDescription"),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("feedback.replyFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  const getCounterparty = (thread) => (user.role === "PARENT" ? thread.staff : thread.parent);

  if (!["PARENT", "TEACHER"].includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="stack-xl">
      <PageHeader
        title={t("feedback.title")}
        description={t("feedback.description")}
      />

      <section className="feedback-layout">
        <div className="stack-lg">
          <article className="panel">
            <div className="panel__header">
              <div>
                <h2>{t("feedback.composeTitle")}</h2>
                <p>{t("feedback.composeDescription")}</p>
              </div>
            </div>

            <form className="stack-md" onSubmit={handleCreateThread}>
              {user.role === "PARENT" ? (
                <label className="field">
                  <span>{t("feedback.staffRecipient")}</span>
                  <select
                    name="staffId"
                    value={composeForm.staffId}
                    onChange={handleComposeChange}
                    required
                  >
                    <option value="">{t("feedback.selectStaff")}</option>
                    {options.staff.map((staffUser) => (
                      <option key={staffUser.id} value={staffUser.id}>
                        {staffUser.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="field">
                  <span>{t("feedback.parentRecipient")}</span>
                  <select
                    name="parentId"
                    value={composeForm.parentId}
                    onChange={handleComposeChange}
                    required
                  >
                    <option value="">{t("feedback.selectParent")}</option>
                    {options.parents.map((parentUser) => (
                      <option key={parentUser.id} value={parentUser.id}>
                        {parentUser.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="field">
                <span>{t("feedback.childOptional")}</span>
                <select
                  name="childId"
                  value={composeForm.childId}
                  onChange={handleComposeChange}
                >
                  <option value="">{t("feedback.noChild")}</option>
                  {filteredChildren.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.fullName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>{t("feedback.subject")}</span>
                <input
                  name="subject"
                  value={composeForm.subject}
                  onChange={handleComposeChange}
                  placeholder={t("feedback.subjectPlaceholder")}
                  required
                />
              </label>

              <label className="field">
                <span>{t("feedback.message")}</span>
                <textarea
                  name="message"
                  value={composeForm.message}
                  onChange={handleComposeChange}
                  placeholder={t("feedback.messagePlaceholder")}
                  rows="5"
                  required
                />
              </label>

              <button type="submit" className="button button--primary">
                <MessageSquare size={16} />
                {t("feedback.create")}
              </button>
            </form>
          </article>

          <article className="panel">
            <div className="panel__header">
              <div>
                <h2>{t("feedback.threadsTitle")}</h2>
                <p>{t("feedback.threadsDescription")}</p>
              </div>
            </div>

            <div className="feedback-thread-list">
              {threads.map((thread) => {
                const counterparty = getCounterparty(thread);

                return (
                  <button
                    type="button"
                    key={thread.id}
                    className={
                      thread.id === selectedThreadId
                        ? "feedback-thread-card feedback-thread-card--active"
                        : "feedback-thread-card"
                    }
                    onClick={() => openThread(thread.id)}
                  >
                    <div className="feedback-thread-card__head">
                      <strong>{thread.subject}</strong>
                      <span>{formatDateTime(thread.lastMessageAt, locale)}</span>
                    </div>
                    <span>
                      {user.role === "PARENT"
                        ? `${t("feedback.staffLabel")}: ${counterparty?.fullName || "-"}`
                        : `${t("feedback.parentLabel")}: ${counterparty?.fullName || "-"}`}
                    </span>
                    {thread.child ? (
                      <span>{`${t("feedback.childLabel")}: ${thread.child.fullName}`}</span>
                    ) : null}
                    <p>{thread.latestMessage?.body || t("feedback.noMessages")}</p>
                  </button>
                );
              })}

              {!threads.length ? (
                <div className="empty-state">{t("feedback.noThreads")}</div>
              ) : null}
            </div>
          </article>
        </div>

        <article className="panel feedback-thread-panel">
          {selectedThread ? (
            <div className="stack-lg">
              <div className="panel__header">
                <div>
                  <h2>{selectedThread.subject}</h2>
                  <p>{t("feedback.threadDescription")}</p>
                </div>
              </div>

              <div className="feedback-thread-meta">
                <span>
                  {user.role === "PARENT"
                    ? `${t("feedback.staffLabel")}: ${selectedThread.staff?.fullName || "-"}`
                    : `${t("feedback.parentLabel")}: ${selectedThread.parent?.fullName || "-"}`}
                </span>
                {selectedThread.child ? (
                  <span>{`${t("feedback.childLabel")}: ${selectedThread.child.fullName}`}</span>
                ) : null}
              </div>

              <div className="feedback-message-list">
                {selectedThread.messages?.map((message) => {
                  const ownMessage = message.senderId === user.id;

                  return (
                    <div
                      key={message.id}
                      className={
                        ownMessage
                          ? "feedback-message feedback-message--own"
                          : "feedback-message"
                      }
                    >
                      <div className="feedback-message__meta">
                        <strong>{message.sender?.fullName}</strong>
                        <span>{formatDateTime(message.createdAt, locale)}</span>
                      </div>
                      <p>{message.body}</p>
                    </div>
                  );
                })}

                {!selectedThread.messages?.length ? (
                  <div className="empty-state">{t("feedback.noMessages")}</div>
                ) : null}
              </div>

              <form className="stack-md" onSubmit={handleReply}>
                <label className="field">
                  <span>{t("feedback.message")}</span>
                  <textarea
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    placeholder={t("feedback.replyPlaceholder")}
                    rows="4"
                    required
                  />
                </label>

                <button type="submit" className="button button--primary">
                  <SendHorizontal size={16} />
                  {t("feedback.sendReply")}
                </button>
              </form>
            </div>
          ) : (
            <div className="empty-state empty-state--large">{t("feedback.noSelection")}</div>
          )}
        </article>
      </section>
    </div>
  );
}
