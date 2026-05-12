// Кратко: единая точка входа, где родитель регистрируется, а админ и преподаватель входят в систему.
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

const defaultParentLoginForm = {
  phone: "",
  password: "",
};

const defaultParentRegisterForm = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
};

const defaultTeacherForm = {
  phone: "",
  password: "",
};

// React-компонент LoginPage: собирает экран и связывает его с состоянием и API.
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loginAdmin, registerParent, loginParent, loginTeacher } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [roleMode, setRoleMode] = useState("parent");
  const [parentMode, setParentMode] = useState("register");
  const [adminForm, setAdminForm] = useState(defaultAdminForm);
  const [parentLoginForm, setParentLoginForm] = useState(defaultParentLoginForm);
  const [parentRegisterForm, setParentRegisterForm] = useState(defaultParentRegisterForm);
  const [teacherForm, setTeacherForm] = useState(defaultTeacherForm);
  const [submitting, setSubmitting] = useState(false);
  const [visiblePasswordField, setVisiblePasswordField] = useState(null);

  useEffect(() => {
    // Если interceptor выбросил пользователя из-за просроченной сессии,
    // показываем причину прямо на login, а не оставляем молчаливый logout.
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

  if (user) {
    return <Navigate to="/" replace />;
  }

  // Функция togglePasswordVisibility: переключает локальное состояние интерфейса.
  const togglePasswordVisibility = (fieldName) => {
    setVisiblePasswordField((current) => (current === fieldName ? null : fieldName));
  };

  // Для каждой роли держим отдельный state, чтобы формы не перетирали друг друга при переключении вкладок.
  const handleAdminChange = (event) => {
    const { name, value } = event.target;
    setAdminForm((current) => ({ ...current, [name]: value }));
  };

  // Функция handleParentLoginChange: обрабатывает пользовательское действие или событие.
  const handleParentLoginChange = (event) => {
    const { name, value } = event.target;
    setParentLoginForm((current) => ({ ...current, [name]: value }));
  };

  // Функция handleParentRegisterChange: обрабатывает пользовательское действие или событие.
  const handleParentRegisterChange = (event) => {
    const { name, value } = event.target;
    setParentRegisterForm((current) => ({ ...current, [name]: value }));
  };

  // Функция handleTeacherChange: обрабатывает пользовательское действие или событие.
  const handleTeacherChange = (event) => {
    const { name, value } = event.target;
    setTeacherForm((current) => ({ ...current, [name]: value }));
  };

  // submit-обработчики разделены по ролям, потому что backend использует разные endpoints и разную валидацию.
  const handleAdminSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

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

  // Функция handleParentRegisterSubmit: обрабатывает пользовательское действие или событие.
  const handleParentRegisterSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await registerParent(parentRegisterForm);
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

  // Функция handleParentLoginSubmit: обрабатывает пользовательское действие или событие.
  const handleParentLoginSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await loginParent(parentLoginForm);
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

  // Функция handleTeacherSubmit: обрабатывает пользовательское действие или событие.
  const handleTeacherSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await loginTeacher(teacherForm);
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

  return (
    <div className="auth-shell">
      <section className="auth-showcase">
        <div className="auth-showcase__badge">
          <img className="auth-showcase__badge-logo" src="/umiko-mark.svg" alt="" aria-hidden="true" />
          {t("login.badge")}
        </div>
        <img className="auth-showcase__logo" src="/umiko-logo.svg" alt="umiko" />
        <h1 className="sr-only">umiko</h1>
        <p>{t("login.accessDescription")}</p>

        <div className="showcase-grid">
          <article className="showcase-card">
            <Sparkles size={18} />
            <strong>{t("login.roleParent")}</strong>
            <span>{t("login.parentCardDescription")}</span>
          </article>
          <article className="showcase-card">
            <Star size={18} />
            <strong>{t("roles.TEACHER")}</strong>
            <span>{t("login.teacherCardDescription")}</span>
          </article>
          <article className="showcase-card">
            <ShieldCheck size={18} />
            <strong>{t("roles.ADMIN")}</strong>
            <span>{t("login.adminCardDescription")}</span>
          </article>
        </div>

        <div className="demo-box">
          <strong>{t("login.demoAccounts")}</strong>
          <span>`admin@kidscrm.local / Admin123!`</span>
          <span>`+77001000011 / Teacher123!`</span>
          <span>`+77001000012 / Teacher123!`</span>
          <span>`+77001000002 / Parent123!`</span>
        </div>
      </section>

      <section className="auth-card">
        {/* Верхние табы переключают именно сценарий входа, а не просто внешний вид формы. */}
        <div className="auth-card__tabs">
          {[
            { key: "parent", label: t("login.roleParent") },
            { key: "teacher", label: t("roles.TEACHER") },
            { key: "admin", label: t("roles.ADMIN") },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={
                roleMode === item.key
                  ? "button button--tab button--tab-active"
                  : "button button--tab"
              }
              onClick={() => setRoleMode(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {roleMode === "admin" ? (
          // Администратор входит по email и паролю, потому что это самый строгий сценарий доступа.
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
                  type={visiblePasswordField === "admin" ? "text" : "password"}
                  name="password"
                  value={adminForm.password}
                  onChange={handleAdminChange}
                  placeholder={t("login.passwordPlaceholder")}
                  required
                />
                <button
                  type="button"
                  className="password-field__toggle"
                  onClick={() => togglePasswordVisibility("admin")}
                  aria-label={
                    visiblePasswordField === "admin"
                      ? t("common.hidePassword")
                      : t("common.showPassword")
                  }
                >
                  {visiblePasswordField === "admin" ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <button type="submit" className="button button--primary button--full" disabled={submitting}>
              {submitting ? t("login.pleaseWait") : t("login.adminLoginAction")}
            </button>
          </form>
        ) : null}

        {roleMode === "parent" ? (
          // Родительский сценарий объединяет регистрацию и вход в одном блоке, чтобы не плодить отдельные страницы.
          <div className="stack-lg">
            <div className="auth-card__tabs">
              <button
                type="button"
                className={
                  parentMode === "register"
                    ? "button button--tab button--tab-active"
                    : "button button--tab"
                }
                onClick={() => setParentMode("register")}
              >
                {t("login.parentRegisterMode")}
              </button>
              <button
                type="button"
                className={
                  parentMode === "login"
                    ? "button button--tab button--tab-active"
                    : "button button--tab"
                }
                onClick={() => setParentMode("login")}
              >
                {t("login.parentLoginMode")}
              </button>
            </div>

            {parentMode === "register" ? (
              <form className="stack-lg" onSubmit={handleParentRegisterSubmit}>
                <label className="field">
                  <span>{t("login.fullName")}</span>
                  <input
                    name="fullName"
                    value={parentRegisterForm.fullName}
                    onChange={handleParentRegisterChange}
                    placeholder={t("login.fullNamePlaceholder")}
                    required
                  />
                </label>
                <label className="field">
                  <span>{t("login.email")}</span>
                  <input
                    type="email"
                    name="email"
                    value={parentRegisterForm.email}
                    onChange={handleParentRegisterChange}
                    placeholder={t("login.emailPlaceholder")}
                    required
                  />
                </label>
                <label className="field">
                  <span>{t("login.phone")}</span>
                  <input
                    type="tel"
                    name="phone"
                    value={parentRegisterForm.phone}
                    onChange={handleParentRegisterChange}
                    placeholder={t("login.phonePlaceholder")}
                    required
                  />
                </label>
                <label className="field">
                  <span>{t("login.password")}</span>
                  <div className="password-field">
                    <input
                      type={visiblePasswordField === "parent-register" ? "text" : "password"}
                      name="password"
                      value={parentRegisterForm.password}
                      onChange={handleParentRegisterChange}
                      placeholder={t("login.passwordPlaceholder")}
                      required
                    />
                    <button
                      type="button"
                      className="password-field__toggle"
                      onClick={() => togglePasswordVisibility("parent-register")}
                      aria-label={
                        visiblePasswordField === "parent-register"
                          ? t("common.hidePassword")
                          : t("common.showPassword")
                      }
                    >
                      {visiblePasswordField === "parent-register" ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="helper-text">{t("login.registerHint")}</p>
                </label>
                <button type="submit" className="button button--primary button--full" disabled={submitting}>
                  {submitting ? t("login.pleaseWait") : t("login.parentRegisterAction")}
                </button>
              </form>
            ) : (
              <form className="stack-lg" onSubmit={handleParentLoginSubmit}>
                <label className="field">
                  <span>{t("login.phone")}</span>
                  <input
                    type="tel"
                    name="phone"
                    value={parentLoginForm.phone}
                    onChange={handleParentLoginChange}
                    placeholder={t("login.phonePlaceholder")}
                    required
                  />
                </label>
                <label className="field">
                  <span>{t("login.password")}</span>
                  <div className="password-field">
                    <input
                      type={visiblePasswordField === "parent-login" ? "text" : "password"}
                      name="password"
                      value={parentLoginForm.password}
                      onChange={handleParentLoginChange}
                      placeholder={t("login.passwordPlaceholder")}
                      required
                    />
                    <button
                      type="button"
                      className="password-field__toggle"
                      onClick={() => togglePasswordVisibility("parent-login")}
                      aria-label={
                        visiblePasswordField === "parent-login"
                          ? t("common.hidePassword")
                          : t("common.showPassword")
                      }
                    >
                      {visiblePasswordField === "parent-login" ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                <button type="submit" className="button button--primary button--full" disabled={submitting}>
                  {submitting ? t("login.pleaseWait") : t("login.parentLoginAction")}
                </button>
              </form>
            )}
          </div>
        ) : null}

        {roleMode === "teacher" ? (
          // У преподавателя нет публичной регистрации: он входит только по данным, которые создал администратор.
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
            <label className="field">
              <span>{t("login.password")}</span>
              <div className="password-field">
                <input
                  type={visiblePasswordField === "teacher" ? "text" : "password"}
                  name="password"
                  value={teacherForm.password}
                  onChange={handleTeacherChange}
                  placeholder={t("login.passwordPlaceholder")}
                  required
                />
                <button
                  type="button"
                  className="password-field__toggle"
                  onClick={() => togglePasswordVisibility("teacher")}
                  aria-label={
                    visiblePasswordField === "teacher"
                      ? t("common.hidePassword")
                      : t("common.showPassword")
                  }
                >
                  {visiblePasswordField === "teacher" ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="helper-text">{t("login.teacherAccessNote")}</p>
            </label>
            <button type="submit" className="button button--primary button--full" disabled={submitting}>
              {submitting ? t("login.pleaseWait") : t("login.teacherLoginAction")}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
