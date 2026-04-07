import { Html5QrcodeScanner } from "html5-qrcode";
import {
  Check,
  QrCode,
  ScanLine,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";
import { formatDate, formatDateTime, formatStatus } from "../utils/format.js";

const qrReaderElementId = "attendance-qr-reader";

export function AttendancePage() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
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

  useEffect(() => {
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

        setLessons(lessonsResponse.data.items);
        setEnrollments(enrollmentsResponse.data.items);

        if (lessonsResponse.data.items[0]) {
          setSelectedLessonId(lessonsResponse.data.items[0].id);
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
    if (!selectedLessonId || user.role === "PARENT") {
      return;
    }

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
    if (!scannerEnabled || user.role !== "STAFF") {
      return;
    }

    const scanner = new Html5QrcodeScanner(
      qrReaderElementId,
      {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        rememberLastUsedCamera: true,
      },
      false,
    );

    let active = true;
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

    return () => {
      active = false;
      scannerRef.current = null;
      Promise.resolve(scanner.clear()).catch(() => {});
    };
  }, [scannerEnabled, user.role]);

  useEffect(() => {
    if (!queuedQrToken) {
      return;
    }

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
      enrollments.filter((enrollment) => enrollment.lessonId === selectedLessonId),
    [enrollments, selectedLessonId],
  );

  const qrEligibleEnrollments = useMemo(
    () =>
      enrollments.filter(
        (enrollment) =>
          enrollment.status !== "CANCELLED" && enrollment.lesson && enrollment.child,
      ),
    [enrollments],
  );

  const handleMarkAttendance = async (enrollmentId, status) => {
    try {
      await api.post("/attendance", {
        enrollmentId,
        status,
      });

      setEnrollments((current) =>
        current.map((enrollment) =>
          enrollment.id === enrollmentId
            ? {
                ...enrollment,
                status: status === "PRESENT" ? "ATTENDED" : "MISSED",
              }
            : enrollment,
        ),
      );

      const { data } = await api.get(`/attendance/${selectedLessonId}`);
      setAttendanceRecords(data.items);
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

  const handleLoadQrPass = async (enrollmentId) => {
    try {
      const { data } = await api.get(`/attendance/qr/${enrollmentId}`);
      setSelectedQrPass(data.qr);
    } catch (error) {
      showToast({
        title: t("attendance.qrLoadFailed"),
        description: error.message,
        tone: "error",
      });
    }
  };

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
        <PageHeader
          title={t("attendance.titleParent")}
          description={t("attendance.descriptionParent")}
        />

        <section className="two-column">
          <article className="panel stack-lg">
            <div className="panel__header">
              <div>
                <h2>{t("attendance.parentPassesTitle")}</h2>
                <p>{t("attendance.parentPassesDescription")}</p>
              </div>
              <QrCode size={18} />
            </div>

            {qrEligibleEnrollments.length ? (
              <div className="stack-md">
                {qrEligibleEnrollments.map((enrollment) => (
                  <article className="qr-pass-list-item" key={enrollment.id}>
                    <div>
                      <strong>{enrollment.child?.fullName}</strong>
                      <span>{enrollment.lesson?.title}</span>
                      <span>
                        {formatDate(enrollment.lesson?.date, locale)} • {enrollment.lesson?.startTime}
                      </span>
                    </div>
                    <div className="stack-sm">
                      <StatusBadge status={enrollment.attendance?.status || enrollment.status} />
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => handleLoadQrPass(enrollment.id)}
                      >
                        <QrCode size={16} />
                        {t("attendance.showQr")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">{t("attendance.noParentItems")}</div>
            )}
          </article>

          <article className="panel">
            <div className="panel__header">
              <div>
                <h2>{t("attendance.qrPassTitle")}</h2>
                <p>{t("attendance.qrPassDescription")}</p>
              </div>
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
                    <p>
                      {formatDate(selectedQrPass.enrollment.lesson.date, locale)} •{" "}
                      {selectedQrPass.enrollment.lesson.startTime}
                    </p>
                  </div>
                  <div className="detail-card">
                    <span>{t("attendance.qrExpiresAt")}</span>
                    <strong>{formatDateTime(selectedQrPass.expiresAt, locale)}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">{t("attendance.qrEmpty")}</div>
            )}
          </article>
        </section>

        <section className="card-grid">
          {enrollments.map((enrollment) => (
            <article className="panel stack-sm" key={enrollment.id}>
              <strong>{enrollment.child?.fullName}</strong>
              <span>{enrollment.lesson?.title}</span>
              <span>{formatDate(enrollment.lesson?.date, locale)}</span>
              <StatusBadge
                status={enrollment.attendance?.status || enrollment.status}
              />
            </article>
          ))}
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
              {scannerEnabled ? t("attendance.stopScanner") : t("attendance.startScanner")}
            </button>
          </div>

          {scannerEnabled ? <div id={qrReaderElementId} className="qr-scanner-shell" /> : null}

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

        <article className="panel">
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
        </article>
      </section>

      <div className="table-shell">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("attendance.child")}</th>
              <th>{t("attendance.status")}</th>
              <th>{t("attendance.markedBy")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lessonEnrollments.map((enrollment) => {
              const record = attendanceByEnrollmentId[enrollment.id];
              return (
                <tr key={enrollment.id}>
                  <td>{enrollment.child?.fullName}</td>
                  <td>
                    <StatusBadge status={record?.status || enrollment.status} />
                  </td>
                  <td>{record?.markedBy?.fullName || t("attendance.notMarkedYet")}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => handleMarkAttendance(enrollment.id, "PRESENT")}
                      >
                        <Check size={16} />
                        {t("attendance.present")}
                      </button>
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => handleMarkAttendance(enrollment.id, "ABSENT")}
                      >
                        <X size={16} />
                        {t("attendance.absent")}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!lessonEnrollments.length ? (
          <div className="empty-state">{t("attendance.noLessonEnrollments")}</div>
        ) : null}
      </div>
    </div>
  );
}
