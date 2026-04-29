import { Eye, EyeOff, ShieldCheck, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";

const AUTH_EXPIRED_KEY = "kids-crm.authExpired";

const defaultAdminForm = {
  email: "",
  password: "",
};

const defaultParentForm = {
  fullName: "",
  phone: "",
  code: "",
};

const defaultTeacherForm = {
  phone: "",
  code: "",
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    loginAdmin,
    requestParentCode,
    verifyParentCode,
    requestTeacherMagicLink,
    verifyTeacherMagicLink,
    requestTeacherCode,
    verifyTeacherCode,
  } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [roleMode, setRoleMode] = useState("parent");
  const [teacherAuthMode, setTeacherAuthMode] = useState("magic");
  const [adminForm, setAdminForm] = useState(defaultAdminForm);
  const [parentForm, setParentForm] = useState(defaultParentForm);
  const [teacherForm, setTeacherForm] = useState(defaultTeacherForm);
  const [parentStage, setParentStage] = useState("request");
  const [teacherSmsStage, setTeacherSmsStage] = useState("request");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [devHint, setDevHint] = useState(null);

  useEffect(() => {
    if (sessionStorage.getItem(AUTH_EXPIRED_KEY) !== "1") {
      return;
    }

    sessionStorage.removeItem(AUTH_EXPIRED_KEY);
    showToast({
      title: t("login.sessionExpiredTitle"),
      description: t("login.sessionExpiredDescription"),
      tone: "error",
    });
  }, [showToast, t]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const teacherMagicToken = params.get("teacherMagicToken");

    if (!teacherMagicToken || user) {
      return;
    }

    const verifyToken = async () => {
      try {
        await verifyTeacherMagicLink({ token: teacherMagicToken });
        navigate(location.state?.from?.pathname || "/", { replace: true });
      } catch (error) {
        showToast({
          title: t("login.authFailed"),
          description: error.message,
          tone: "error",
        });
      }
    };

    void verifyToken();
  }, [location.search, location.state?.from?.pathname, navigate, showToast, t, user, verifyTeacherMagicLink]);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const resetHints = () => setDevHint(null);

  const handleAdminChange = (event) => {
    const { name, value } = event.target;
    setAdminForm((current) => ({ ...current, [name]: value }));
  };

  const handleParentChange = (event) => {
    const { name, value } = event.target;
    setParentForm((current) => ({ ...current, [name]: value }));
  };

  const handleTeacherChange = (event) => {
    const { name, value } = event.target;
    setTeacherForm((current) => ({ ...current, [name]: value }));
  };

  const handleAdminSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    resetHints();

    try {
      await loginAdmin(adminForm);
      navigate(location.state?.from?.pathname || "/");
    } catch (error) {
      showToast({
        title: t("login.authFailed"),
        description: error.message,
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleParentSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    resetHints();

    try {
      if (parentStage === "request") {
        const data = await requestParentCode({
          fullName: parentForm.fullName,
          phone: parentForm.phone,
        });
        setParentStage("verify");
        setDevHint(
          data.devCode
            ? `Dev SMS-код для родителя: ${data.devCode}`
            : "SMS-код отправлен.",
        );
      } else {
        await verifyParentCode(parentForm);
        navigate(location.state?.from?.pathname || "/");
      }
    } catch (error) {
      showToast({
        title: t("login.authFailed"),
        description: error.message,
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTeacherSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    resetHints();

    try {
      if (teacherAuthMode === "magic") {
        const data = await requestTeacherMagicLink({
          phone: teacherForm.phone,
        });
        setDevHint(
          data.magicLink
            ? `Dev magic link: ${data.magicLink}`
            : "Ссылка для входа отправлена.",
        );
      } else if (teacherSmsStage === "request") {
        const data = await requestTeacherCode({
          phone: teacherForm.phone,
        });
        setTeacherSmsStage("verify");
        setDevHint(
          data.devCode
            ? `Dev SMS-код для преподавателя: ${data.devCode}`
            : "SMS-код отправлен.",
        );
      } else {
        await verifyTeacherCode(teacherForm);
        navigate(location.state?.from?.pathname || "/");
      }
    } catch (error) {
      showToast({
        title: t("login.authFailed"),
        description: error.message,
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-showcase">
        <div className="auth-showcase__badge">
          <ShieldCheck size={18} />
          {t("login.badge")}
        </div>
        <h1>CRM для образовательного центра</h1>
        <p>Три роли, разные сценарии входа и единый рабочий контур для родителей, преподавателей и администратора.</p>

        <div className="showcase-grid">
          <article className="showcase-card">
            <Sparkles size={18} />
            <strong>Родитель</strong>
            <span>Вход по номеру телефона и SMS-коду.</span>
          </article>
          <article className="showcase-card">
            <Star size={18} />
            <strong>Преподаватель</strong>
            <span>Вход по magic link или SMS-коду.</span>
          </article>
          <article className="showcase-card">
            <ShieldCheck size={18} />
            <strong>Администратор</strong>
            <span>Вход по email и паролю.</span>
          </article>
        </div>

        <div className="demo-box">
          <strong>Тестовые аккаунты</strong>
          <span>`admin@kidscrm.local / Admin123!`</span>
          <span>`+77001000011` и `+77001000012` для преподавателей</span>
          <span>`+77001000002` и `+77001000003` для родителей</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-card__tabs">
          {[
            { key: "parent", label: "Родитель" },
            { key: "teacher", label: "Преподаватель" },
            { key: "admin", label: "Администратор" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={
                roleMode === item.key
                  ? "button button--tab button--tab-active"
                  : "button button--tab"
              }
              onClick={() => {
                setRoleMode(item.key);
                resetHints();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {roleMode === "admin" ? (
          <form className="stack-lg" onSubmit={handleAdminSubmit}>
            <label className="field">
              <span>{t("login.email")}</span>
              <input
                type="email"
                name="email"
                value={adminForm.email}
                onChange={handleAdminChange}
                placeholder={t("login.emailPlaceholder")}
                required
              />
            </label>

            <label className="field">
              <span>{t("login.password")}</span>
              <div className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={adminForm.password}
                  onChange={handleAdminChange}
                  placeholder={t("login.passwordPlaceholder")}
                  required
                />
                <button
                  type="button"
                  className="password-field__toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={
                    showPassword ? t("common.hidePassword") : t("common.showPassword")
                  }
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <button type="submit" className="button button--primary button--full" disabled={submitting}>
              {submitting ? t("login.pleaseWait") : "Войти как администратор"}
            </button>
          </form>
        ) : null}

        {roleMode === "parent" ? (
          <form className="stack-lg" onSubmit={handleParentSubmit}>
            <label className="field">
              <span>{t("login.fullName")}</span>
              <input
                name="fullName"
                value={parentForm.fullName}
                onChange={handleParentChange}
                placeholder={t("login.fullNamePlaceholder")}
                required={parentStage === "request"}
              />
            </label>
            <label className="field">
              <span>{t("login.phone")}</span>
              <input
                type="tel"
                name="phone"
                value={parentForm.phone}
                onChange={handleParentChange}
                placeholder={t("login.phonePlaceholder")}
                required
              />
            </label>
            {parentStage === "verify" ? (
              <label className="field">
                <span>SMS-код</span>
                <input
                  name="code"
                  value={parentForm.code}
                  onChange={handleParentChange}
                  placeholder="6 цифр"
                  required
                />
              </label>
            ) : null}
            {devHint ? <p className="helper-text">{devHint}</p> : null}
            <button type="submit" className="button button--primary button--full" disabled={submitting}>
              {submitting
                ? t("login.pleaseWait")
                : parentStage === "request"
                  ? "Получить SMS-код"
                  : "Подтвердить код"}
            </button>
          </form>
        ) : null}

        {roleMode === "teacher" ? (
          <div className="stack-lg">
            <div className="auth-card__tabs">
              <button
                type="button"
                className={
                  teacherAuthMode === "magic"
                    ? "button button--tab button--tab-active"
                    : "button button--tab"
                }
                onClick={() => {
                  setTeacherAuthMode("magic");
                  resetHints();
                }}
              >
                Magic link
              </button>
              <button
                type="button"
                className={
                  teacherAuthMode === "sms"
                    ? "button button--tab button--tab-active"
                    : "button button--tab"
                }
                onClick={() => {
                  setTeacherAuthMode("sms");
                  resetHints();
                }}
              >
                SMS
              </button>
            </div>

            <form className="stack-lg" onSubmit={handleTeacherSubmit}>
              <label className="field">
                <span>{t("login.phone")}</span>
                <input
                  type="tel"
                  name="phone"
                  value={teacherForm.phone}
                  onChange={handleTeacherChange}
                  placeholder={t("login.phonePlaceholder")}
                  required
                />
              </label>
              {teacherAuthMode === "sms" && teacherSmsStage === "verify" ? (
                <label className="field">
                  <span>SMS-код</span>
                  <input
                    name="code"
                    value={teacherForm.code}
                    onChange={handleTeacherChange}
                    placeholder="6 цифр"
                    required
                  />
                </label>
              ) : null}
              {devHint ? <p className="helper-text">{devHint}</p> : null}
              <button type="submit" className="button button--primary button--full" disabled={submitting}>
                {submitting
                  ? t("login.pleaseWait")
                  : teacherAuthMode === "magic"
                    ? "Получить ссылку"
                    : teacherSmsStage === "request"
                      ? "Получить SMS-код"
                      : "Подтвердить код"}
              </button>
            </form>
          </div>
        ) : null}
      </section>
    </div>
  );
}
