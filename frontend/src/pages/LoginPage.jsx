import { Eye, EyeOff, ShieldCheck, Sparkles, Star } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";

const defaultForm = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, register } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      if (mode === "login") {
        await login({
          email: form.email,
          password: form.password,
        });
      } else {
        await register(form);
      }

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
          <ShieldCheck size={18} />
          {t("login.badge")}
        </div>
        <h1>{t("login.headline")}</h1>
        <p>{t("login.description")}</p>

        <div className="showcase-grid">
          <article className="showcase-card">
            <Sparkles size={18} />
            <strong>{t("login.rolesTitle")}</strong>
            <span>{t("login.rolesDescription")}</span>
          </article>
          <article className="showcase-card">
            <Star size={18} />
            <strong>{t("login.paymentsTitle")}</strong>
            <span>{t("login.paymentsDescription")}</span>
          </article>
        </div>

        <div className="demo-box">
          <strong>{t("login.demoAccounts")}</strong>
          <span>`parent@kidscrm.local / Parent123!`</span>
          <span>{t("login.staffAccessNote")}</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-card__tabs">
          <button
            type="button"
            className={
              mode === "login"
                ? "button button--tab button--tab-active"
                : "button button--tab"
            }
            onClick={() => setMode("login")}
          >
            {t("login.signIn")}
          </button>
          <button
            type="button"
            className={
              mode === "register"
                ? "button button--tab button--tab-active"
                : "button button--tab"
            }
            onClick={() => setMode("register")}
          >
            {t("login.register")}
          </button>
        </div>

        <form className="stack-lg" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <>
              <label className="field">
                <span>{t("login.fullName")}</span>
                <input
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  placeholder={t("login.fullNamePlaceholder")}
                  required
                />
              </label>
              <label className="field">
                <span>{t("login.phone")}</span>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder={t("login.phonePlaceholder")}
                  inputMode="tel"
                  required
                />
              </label>
              <p className="helper-text">{t("login.registerHint")}</p>
            </>
          ) : null}

          <label className="field">
            <span>{t("login.email")}</span>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
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
                value={form.password}
                onChange={handleChange}
                placeholder={t("login.passwordPlaceholder")}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
              <button
                type="button"
                className="password-field__toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={
                  showPassword ? t("common.hidePassword") : t("common.showPassword")
                }
                title={showPassword ? t("common.hidePassword") : t("common.showPassword")}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {mode === "register" ? (
              <p className="helper-text">{t("login.passwordHint")}</p>
            ) : null}
          </label>

          <button
            type="submit"
            className="button button--primary button--full"
            disabled={submitting}
          >
            {submitting
              ? t("login.pleaseWait")
              : mode === "login"
                ? t("login.signIn")
                : t("login.createAccount")}
          </button>
        </form>
      </section>
    </div>
  );
}
