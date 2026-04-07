import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../components/PageHeader.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { useToast } from "../hooks/useToast.js";

export function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    fullName: user.fullName,
    email: user.email,
    phone: user.phone || "",
    newPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      await updateProfile({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        newPassword: form.newPassword || undefined,
      });

      setForm((current) => ({ ...current, newPassword: "" }));
      showToast({
        title: t("settings.updated"),
        description: t("settings.updatedDescription"),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("settings.updateFailed"),
        description: error.message,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack-xl">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <section className="panel">
        <form className="stack-lg" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field">
              <span>{t("settings.fullName")}</span>
              <input
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                required
              />
            </label>
            <label className="field">
              <span>{t("settings.email")}</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </label>
            <label className="field">
              <span>{t("settings.phone")}</span>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder={t("settings.phonePlaceholder")}
                inputMode="tel"
              />
            </label>
            <label className="field">
              <span>{t("settings.newPassword")}</span>
              <div className="password-field">
                <input
                  type={showNewPassword ? "text" : "password"}
                  name="newPassword"
                  value={form.newPassword}
                  onChange={handleChange}
                  placeholder={t("settings.newPasswordPlaceholder")}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-field__toggle"
                  onClick={() => setShowNewPassword((current) => !current)}
                  aria-label={
                    showNewPassword ? t("common.hidePassword") : t("common.showPassword")
                  }
                  title={
                    showNewPassword ? t("common.hidePassword") : t("common.showPassword")
                  }
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="helper-text">{t("settings.passwordHint")}</p>
            </label>
          </div>

          <button
            type="submit"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? t("settings.saving") : t("settings.saveSettings")}
          </button>
        </form>
      </section>
    </div>
  );
}
