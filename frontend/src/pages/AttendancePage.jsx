// Кратко: экран посещаемости для родителя, преподавателя и администратора.
import {
  CalendarDays,
  Check,
  QrCode,
  ScanLine,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import { formatDate, formatDateTime, formatStatus } from "../utils/format.js";
import { compareLessonDateTime, isFutureOrTodayLesson } from "../utils/schedule.js";

const qrReaderElementId = "attendance-qr-reader";

// Функция getLessonDateTimeValue: возвращает значение или подготовленные данные по входным параметрам.
const getLessonDateTimeValue = (source) => {
  const lesson = source.lesson || source;
  const value = new Date(lesson.date);

  if (lesson.startTime) {
    const [hours = "0", minutes = "0"] = lesson.startTime.split(":");
    value.setHours(Number(hours), Number(minutes), 0, 0);
  }

  return value;
};

// Функция compareLessons: сравнивает значения для сортировки или выбора.
const compareLessons = (left, right) =>
  getLessonDateTimeValue(left) - getLessonDateTimeValue(right);

// Функция resolveAttendanceStatus: определяет итоговое значение по входным данным.
const resolveAttendanceStatus = (enrollment, record) =>
  record?.status || enrollment.attendance?.status || enrollment.status;

// Функция isPresentStatus: проверяет условие и возвращает логический результат.
const isPresentStatus = (status) => status === "PRESENT" || status === "ATTENDED";
// Функция isAbsentStatus: проверяет условие и возвращает логический результат.
const isAbsentStatus = (status) => status === "ABSENT" || status === "MISSED";

// React-компонент AttendancePage: собирает экран и связывает его с состоянием и API.
export function AttendancePage() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const scannerRef = useRef(null);
  const [lessons, setLessons] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [selectedQrPass, setSelectedQrPass] = useState(null);
  const [scannerEnabled, setScannerEnabled] = useState(false);
  const [manualQrToken, setManualQrToken] = useState("");
  const [scanComment, setScanComment] = useState("");
  const [queuedQrToken, setQueuedQrToken] = useState("");
  const [lastScanResult, setLastScanResult] = useState(null);
  const canManageAttendance = user.role === "ADMIN" || user.role === "TEACHER";
  const hasScanModeParam =
    canManageAttendance && searchParams.get("mode") === "scan";
  const scannerActive = scannerEnabled || hasScanModeParam;

  useEffect(() => {
    // Родитель загружает только свои записи, а админ/преподаватель — занятия и общий список записей по центру.
    const bootstrap = async () => {
      try {
        if (user.role === "PARENT") {
          const { data } = await api.get("/enrollments/my");
          setEnrollments(data.items);
          return;
        }

        const [lessonsResponse, enrollmentsResponse] = await Promise.all([
          api.get("/lessons"),
          api.get("/enrollments"),
        ]);

        const sortedLessons = [...lessonsResponse.data.items].sort(compareLessons);

        setLessons(sortedLessons);
        setEnrollments(enrollmentsResponse.data.items);

        const nextLesson =
          sortedLessons.find((lesson) => getLessonDateTimeValue(lesson) >= new Date()) ||
          sortedLessons[0];

        if (nextLesson) {
          setSelectedLessonId(nextLesson.id);
        }
      } catch (error) {
        showToast({
          title: t("attendance.loadFailed"),
          description: error.message,
          tone: "error",
        });
      }
    };

    bootstrap();
  }, [showToast, t, user.role]);

  useEffect(() => {
    // Для сотрудников журнал посещаемости всегда привязан к выбранному занятию.
    if (!selectedLessonId || user.role === "PARENT") {
      return;
    }

    // Функция loadAttendance: загружает данные и обновляет состояние.
    const loadAttendance = async () => {
      try {
        const { data } = await api.get(`/attendance/${selectedLessonId}`);
        setAttendanceRecords(data.items);
      } catch (error) {
        showToast({
          title: t("attendance.loadLessonFailed"),
          description: error.message,
          tone: "error",
        });
      }
    };

    loadAttendance();
  }, [selectedLessonId, showToast, t, user.role]);

  useEffect(() => {
    if (!canManageAttendance || searchParams.get("mode") !== "scan") {
      return;
    }

    // Параметр mode=scan позволяет открыть сканер из быстрых действий без синхронного setState внутри effect.
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("mode");
      return next;
    });
  }, [canManageAttendance, searchParams, setSearchParams]);

  useEffect(() => {
    // Здесь живёт интеграция со сканером QR: включаем её только когда сотрудник реально открыл режим сканирования.
    if (!scannerActive || !canManageAttendance) {
      return;
    }

    let active = true;
    let scanner = null;

    const mountScanner = async () => {
      const { Html5QrcodeScanner } = await import("html5-qrcode");

      if (!active) {
        return;
      }

      scanner = new Html5QrcodeScanner(
        qrReaderElementId,
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          rememberLastUsedCamera: true,
        },
        false,
      );

      scannerRef.current = scanner;
      scanner.render(
        (decodedText) => {
          if (!active) {
            return;
          }

          setManualQrToken(decodedText);
          setQueuedQrToken(decodedText);
          setScannerEnabled(false);
        },
        () => {},
      );
    };

    mountScanner().catch((error) => {
      showToast({
        title: t("attendance.qrScanFailed"),
        description: error.message,
        tone: "error",
      });
    });

    return () => {
      active = false;
      scannerRef.current = null;
      if (scanner) {
        Promise.resolve(scanner.clear()).catch(() => {});
      }
    };
  }, [canManageAttendance, scannerActive, showToast, t]);

  useEffect(() => {
    // После сканирования не трогаем attendance напрямую в DOM,
    // а отправляем токен на backend, который уже решает, какую запись и как обновить.
    if (!queuedQrToken) {
      return;
    }

    // Служебная функция processScan: инкапсулирует отдельный шаг логики этого модуля.
    const processScan = async () => {
      try {
        const { data } = await api.post("/attendance/scan", {
          qrToken: queuedQrToken,
          comment: scanComment || undefined,
        });

        setLastScanResult(data);
        setManualQrToken("");
        setScanComment("");
        setSelectedLessonId(data.enrollment.lesson.id);
        setEnrollments((current) =>
          current.map((enrollment) =>
            enrollment.id === data.enrollment.id
              ? {
                  ...enrollment,
                  status: "ATTENDED",
                  attendance: {
                    ...(enrollment.attendance || {}),
                    status: "PRESENT",
                  },
                }
              : enrollment,
          ),
        );

        const refreshedAttendance = await api.get(`/attendance/${data.enrollment.lesson.id}`);
        setAttendanceRecords(refreshedAttendance.data.items);

        showToast({
          title: t("attendance.qrScanSuccess"),
          description: t("attendance.qrScanSuccessDescription", {
            child: data.enrollment.child.fullName,
          }),
          tone: "success",
        });
      } catch (error) {
        showToast({
          title: t("attendance.qrScanFailed"),
          description: error.message,
          tone: "error",
        });
      } finally {
        setQueuedQrToken("");
      }
    };

    processScan();
  }, [queuedQrToken, scanComment, showToast, t]);

  const attendanceByEnrollmentId = useMemo(
    () =>
      Object.fromEntries(
        attendanceRecords.map((record) => [record.enrollment.id, record]),
      ),
    [attendanceRecords],
  );

  const lessonEnrollments = useMemo(
    () =>
      enrollments
        .filter(
          (enrollment) =>
            (enrollment.lessonId === selectedLessonId ||
              enrollment.lesson?.id === selectedLessonId) &&
            enrollment.status !== "CANCELLED",
        )
        .sort(compareLessonDateTime),
    [enrollments, selectedLessonId],
  );

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) || null,
    [lessons, selectedLessonId],
  );

  const parentAttendanceItems = useMemo(
    () =>
      enrollments
        .filter(
          (enrollment) =>
            enrollment.lesson && enrollment.child && enrollment.status !== "CANCELLED",
        )
        .sort(compareLessonDateTime),
    [enrollments],
  );
  const parentMonthlyAttendance = useMemo(() => {
    // В родительском кабинете показываем уже готовый процент посещаемости, а не сырую административную таблицу.
    const now = new Date();
    const monthlyItems = parentAttendanceItems.filter((enrollment) => {
      const lessonDate = new Date(enrollment.lesson?.date);
      return (
        lessonDate.getFullYear() === now.getFullYear() &&
        lessonDate.getMonth() === now.getMonth()
      );
    });

    const present = monthlyItems.filter(
      (enrollment) =>
        enrollment.attendance?.status === "PRESENT" || enrollment.status === "ATTENDED",
    ).length;
    const absent = monthlyItems.filter(
      (enrollment) =>
        enrollment.attendance?.status === "ABSENT" || enrollment.status === "MISSED",
    ).length;
    const total = present + absent;

    return {
      present,
      absent,
      total,
      rate: total ? Math.round((present / total) * 100) : 0,
    };
  }, [parentAttendanceItems]);
  const parentUpcomingEnrollment = useMemo(
    () =>
      parentAttendanceItems.find(
        (enrollment) =>
          enrollment.status === "BOOKED" && isFutureOrTodayLesson(enrollment),
      ) || null,
    [parentAttendanceItems],
  );
  const parentRecentAttendance = useMemo(
    () => parentAttendanceItems.slice(0, 4),
    [parentAttendanceItems],
  );
  const parentAttendanceStats = useMemo(
    () => ({
      present: parentAttendanceItems.filter(
        (enrollment) =>
          enrollment.attendance?.status === "PRESENT" || enrollment.status === "ATTENDED",
      ).length,
      absent: parentAttendanceItems.filter(
        (enrollment) =>
          enrollment.attendance?.status === "ABSENT" || enrollment.status === "MISSED",
      ).length,
      upcoming: parentAttendanceItems.filter(
        (enrollment) =>
          !enrollment.attendance?.status &&
          enrollment.status === "BOOKED" &&
          isFutureOrTodayLesson(enrollment),
      ).length,
    }),
    [parentAttendanceItems],
  );

  const lessonAttendanceStats = useMemo(() => {
    // Сводка по занятию нужна преподавателю перед отметкой:
    // сколько всего детей, сколько уже отмечено и сколько ещё ждут статуса.
    const summary = {
      total: lessonEnrollments.length,
      present: 0,
      absent: 0,
      pending: 0,
    };

    for (const enrollment of lessonEnrollments) {
      const status = resolveAttendanceStatus(
        enrollment,
        attendanceByEnrollmentId[enrollment.id],
      );

      if (isPresentStatus(status)) {
        summary.present += 1;
      } else if (isAbsentStatus(status)) {
        summary.absent += 1;
      } else {
        summary.pending += 1;
      }
    }

    return summary;
  }, [attendanceByEnrollmentId, lessonEnrollments]);

  // Функция handleMarkAttendance: обрабатывает пользовательское действие или событие.
  const handleMarkAttendance = async (enrollmentId, status) => {
    try {
      // Ручная отметка и QR-сценарий сходятся в одном backend-маршруте,
      // чтобы вся бизнес-логика статусов жила в одном месте.
      const { data } = await api.post("/attendance", {
        enrollmentId,
        status,
      });

      setEnrollments((current) =>
        current.map((enrollment) =>
          enrollment.id === enrollmentId
            ? {
                ...enrollment,
                status: data.enrollment.status,
                attendance: {
                  ...(enrollment.attendance || {}),
                  status: data.attendance.status,
                  markedAt: data.attendance.markedAt,
                },
              }
            : enrollment,
        ),
      );

      const { data: attendanceData } = await api.get(`/attendance/${selectedLessonId}`);
      setAttendanceRecords(attendanceData.items);
      showToast({
        title: t("attendance.saved"),
        description: t("attendance.savedDescription", {
          status: formatStatus(status, locale),
        }),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("attendance.saveFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

  const handleLoadQrPass = useCallback(async (enrollmentId) => {
    try {
      // Родитель получает временный QR только по конкретной записи, а не по ребёнку целиком.
      const { data } = await api.get(`/attendance/qr/${enrollmentId}`);
      setSelectedQrPass(data.qr);
    } catch (error) {
      showToast({
        title: t("attendance.qrLoadFailed"),
        description: error.message,
        tone: "error",
      });
    }
  }, [showToast, t]);

  useEffect(() => {
    if (user.role !== "PARENT" || !enrollments.length) {
      return;
    }

    const requestedEnrollmentId = searchParams.get("enrollmentId");
    const requestedEnrollment =
      parentAttendanceItems.find((enrollment) => enrollment.id === requestedEnrollmentId) ||
      null;
    const fallbackEnrollment = parentUpcomingEnrollment;
    const targetEnrollment = requestedEnrollment || fallbackEnrollment;

    const timerId = window.setTimeout(() => {
      if (targetEnrollment) {
        void handleLoadQrPass(targetEnrollment.id);
      }

      if (requestedEnrollmentId) {
        setSearchParams((current) => {
          const next = new URLSearchParams(current);
          next.delete("enrollmentId");
          return next;
        });
      }
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    enrollments.length,
    handleLoadQrPass,
    parentAttendanceItems,
    parentUpcomingEnrollment,
    searchParams,
    setSearchParams,
    user.role,
  ]);

  // Функция handleManualScanSubmit: обрабатывает пользовательское действие или событие.
  const handleManualScanSubmit = async (event) => {
    event.preventDefault();

    if (!manualQrToken.trim()) {
      return;
    }

    setQueuedQrToken(manualQrToken.trim());
  };

  if (user.role === "PARENT") {
    return (
      <div className="stack-xl">
        <PageHeader title={t("attendance.titleParent")} />

        <section className="parent-attendance-grid">
          <article className="panel parent-attendance-summary">
            <div className="parent-section-head">
              <h2>{t("attendance.parentSummaryTitle")}</h2>
              <CalendarDays size={18} />
            </div>

            <div className="parent-attendance-summary__hero">
              <strong>{`${parentMonthlyAttendance.rate}%`}</strong>
              <span>{t("attendance.parentMonthRate")}</span>
            </div>

            <div className="parent-progress">
              <div
                className="parent-progress__fill parent-progress__fill--success"
                style={{ width: `${parentMonthlyAttendance.rate}%` }}
              />
            </div>

            <div className="parent-attendance-summary__facts">
              <div className="parent-finance-pill">
                <span>{t("attendance.absent")}</span>
                <strong>{parentMonthlyAttendance.absent}</strong>
              </div>
              <div className="parent-finance-pill">
                <span>{t("attendance.parentUpcoming")}</span>
                <strong>{parentAttendanceStats.upcoming}</strong>
              </div>
            </div>

            <div className="parent-attendance-insight">
              <span>{t("attendance.parentInsightLabel")}</span>
              <strong>
                {t("attendance.parentInsightText", {
                  missed: parentMonthlyAttendance.absent,
                  total: parentMonthlyAttendance.total,
                })}
              </strong>
            </div>
          </article>

          <article className="panel panel--side">
            <div className="parent-section-head">
              <h2>{t("attendance.qrPassTitle")}</h2>
              <ShieldCheck size={18} />
            </div>

            {selectedQrPass ? (
              <div className="qr-pass-card">
                <div className="qr-pass-card__code">
                  <QRCodeSVG value={selectedQrPass.qrToken} size={220} level="M" />
                </div>
                <div className="stack-md">
                  <div className="detail-card">
                    <span>{t("attendance.child")}</span>
                    <strong>{selectedQrPass.enrollment.child.fullName}</strong>
                  </div>
                  <div className="detail-card">
                    <span>{t("attendance.lesson")}</span>
                    <strong>{selectedQrPass.enrollment.lesson.title}</strong>
                  </div>
                  <div className="detail-card">
                    <span>{t("attendance.qrExpiresAt")}</span>
                    <strong>{formatDateTime(selectedQrPass.expiresAt, locale)}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">{t("attendance.parentQrEmpty")}</div>
            )}
          </article>
        </section>

        <section className="panel panel--side">
          <div className="parent-section-head">
            <h2>{t("attendance.parentHistoryTitle")}</h2>
            <button
              type="button"
              className="button button--secondary"
              onClick={() =>
                parentUpcomingEnrollment && handleLoadQrPass(parentUpcomingEnrollment.id)
              }
              disabled={!parentUpcomingEnrollment}
            >
              <QrCode size={16} />
              {t("attendance.showQr")}
            </button>
          </div>

          {parentRecentAttendance.length ? (
            <div className="stack-md">
              {parentRecentAttendance.map((enrollment) => (
                <article className="parent-schedule-card" key={enrollment.id}>
                  <div className="parent-schedule-card__copy">
                    <strong>{formatDate(enrollment.lesson?.date, locale)}</strong>
                    <span>
                      {enrollment.lesson?.startTime} • {enrollment.child?.fullName}
                    </span>
                  </div>
                  <StatusBadge status={enrollment.attendance?.status || enrollment.status} />
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">{t("attendance.noParentItems")}</div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="stack-xl">
      <PageHeader
        title={t("attendance.titleStaff")}
        description={t("attendance.descriptionStaff")}
      />

      <section className="two-column">
        <article className="panel stack-lg">
          <div className="panel__header">
            <div>
              <h2>{t("attendance.qrScannerTitle")}</h2>
              <p>{t("attendance.qrScannerDescription")}</p>
            </div>
            <ScanLine size={18} />
          </div>

          <div className="row-actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setScannerEnabled((value) => !value)}
            >
              <ScanLine size={16} />
              {scannerActive ? t("attendance.stopScanner") : t("attendance.startScanner")}
            </button>
          </div>

          {scannerActive ? <div id={qrReaderElementId} className="qr-scanner-shell" /> : null}

          <form className="stack-md" onSubmit={handleManualScanSubmit}>
            <label className="field">
              <span>{t("attendance.qrTokenLabel")}</span>
              <textarea
                rows="4"
                value={manualQrToken}
                onChange={(event) => setManualQrToken(event.target.value)}
                placeholder={t("attendance.qrTokenPlaceholder")}
              />
            </label>
            <label className="field">
              <span>{t("attendance.qrCommentLabel")}</span>
              <input
                type="text"
                value={scanComment}
                onChange={(event) => setScanComment(event.target.value)}
                placeholder={t("attendance.qrCommentPlaceholder")}
              />
            </label>
            <button type="submit" className="button button--primary">
              <ShieldCheck size={16} />
              {t("attendance.confirmQr")}
            </button>
          </form>

          {lastScanResult ? (
            <div className="detail-card detail-card--highlight">
              <span>{t("attendance.lastScanResult")}</span>
              <strong>{lastScanResult.enrollment.child.fullName}</strong>
              <p>{lastScanResult.enrollment.lesson.title}</p>
            </div>
          ) : null}
        </article>

        <article className="panel stack-md">
          <div className="panel__header">
            <div>
              <h2>{t("attendance.selectedLessonTitle")}</h2>
              <p>{t("attendance.selectedLessonDescription")}</p>
            </div>
            <CalendarDays size={18} />
          </div>

          <label className="field">
            <span>{t("attendance.lesson")}</span>
            <select
              value={selectedLessonId}
              onChange={(event) => setSelectedLessonId(event.target.value)}
            >
              {lessons.map((lesson) => (
                <option value={lesson.id} key={lesson.id}>
                  {lesson.title} • {formatDate(lesson.date, locale)} •{" "}
                  {lesson.startTime}
                </option>
              ))}
            </select>
          </label>

          {selectedLesson ? (
            <div className="attendance-lesson-card">
              <div className="attendance-lesson-card__row">
                <span>{t("attendance.lessonDate")}</span>
                <strong>{formatDate(selectedLesson.date, locale)}</strong>
              </div>
              <div className="attendance-lesson-card__row">
                <span>{t("attendance.lessonTime")}</span>
                <strong>{`${selectedLesson.startTime} - ${selectedLesson.endTime}`}</strong>
              </div>
              <div className="attendance-lesson-card__row">
                <span>{t("attendance.teacher")}</span>
                <strong>{selectedLesson.teacherName}</strong>
              </div>
              <div className="attendance-lesson-card__row">
                <span>{t("attendance.total")}</span>
                <strong>{lessonAttendanceStats.total}</strong>
              </div>
            </div>
          ) : (
            <div className="empty-state">{t("attendance.noLessons")}</div>
          )}
        </article>
      </section>

      <section className="grid-cards">
        <article className="stat-card stat-card--mint">
          <div className="stat-card__icon">
            <Check size={20} />
          </div>
          <div className="stat-card__body">
            <span>{t("attendance.present")}</span>
            <strong>{lessonAttendanceStats.present}</strong>
          </div>
        </article>
        <article className="stat-card stat-card--danger">
          <div className="stat-card__icon">
            <X size={20} />
          </div>
          <div className="stat-card__body">
            <span>{t("attendance.absent")}</span>
            <strong>{lessonAttendanceStats.absent}</strong>
          </div>
        </article>
        <article className="stat-card stat-card--orange">
          <div className="stat-card__icon">
            <CalendarDays size={20} />
          </div>
          <div className="stat-card__body">
            <span>{t("attendance.pending")}</span>
            <strong>{lessonAttendanceStats.pending}</strong>
          </div>
        </article>
        <article className="stat-card stat-card--blue">
          <div className="stat-card__icon">
            <ShieldCheck size={20} />
          </div>
          <div className="stat-card__body">
            <span>{t("attendance.total")}</span>
            <strong>{lessonAttendanceStats.total}</strong>
          </div>
        </article>
      </section>

      <section className="panel stack-lg">
        <div className="panel__header">
          <div>
            <h2>{t("attendance.rosterTitle")}</h2>
            <p>{t("attendance.rosterDescription")}</p>
          </div>
          <ShieldCheck size={18} />
        </div>

        {lessonEnrollments.length ? (
          <div className="attendance-roster">
            {lessonEnrollments.map((enrollment) => {
              const record = attendanceByEnrollmentId[enrollment.id];
              const currentStatus = resolveAttendanceStatus(enrollment, record);

              return (
                <article className="attendance-roster-card" key={enrollment.id}>
                  <div className="attendance-roster-card__head">
                    <div>
                      <strong>{enrollment.child?.fullName}</strong>
                      <span>{record?.markedBy?.fullName || t("attendance.notMarkedYet")}</span>
                    </div>
                    <StatusBadge status={currentStatus} />
                  </div>

                  <div className="attendance-roster-card__meta">
                    <span>{enrollment.lesson?.title}</span>
                    <span>
                      {formatDate(enrollment.lesson?.date, locale)} • {enrollment.lesson?.startTime}
                    </span>
                  </div>

                  <div className="row-actions">
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => handleMarkAttendance(enrollment.id, "PRESENT")}
                      disabled={isPresentStatus(currentStatus)}
                    >
                      <Check size={16} />
                      {t("attendance.present")}
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => handleMarkAttendance(enrollment.id, "ABSENT")}
                      disabled={isAbsentStatus(currentStatus)}
                    >
                      <X size={16} />
                      {t("attendance.absent")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">{t("attendance.noLessonEnrollments")}</div>
        )}
      </section>
    </div>
  );
}
