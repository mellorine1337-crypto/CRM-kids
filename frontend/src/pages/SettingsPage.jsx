import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
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
  const [teachers, setTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(user.role === "ADMIN");
  const [creatingTeacher, setCreatingTeacher] = useState(false);
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [teacherForm, setTeacherForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });

  useEffect(() => {
    if (user.role !== "ADMIN") {
      return;
    }

    const loadTeachers = async () => {
      setLoadingTeachers(true);

      try {
        const { data } = await api.get("/users/teachers");
        setTeachers(data.items);
      } catch {
        setTeachers([]);
      } finally {
        setLoadingTeachers(false);
      }
    };

    void loadTeachers();
  }, [user.role]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleTeacherChange = (event) => {
    const { name, value } = event.target;
    setTeacherForm((current) => ({ ...current, [name]: value }));
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

  const handleTeacherSubmit = async (event) => {
    event.preventDefault();
    setCreatingTeacher(true);

    try {
      const { data } = await api.post("/users/teachers", teacherForm);
      setTeachers((current) =>
        [...current, data.user].sort((left, right) =>
          left.fullName.localeCompare(right.fullName, "ru"),
        ),
      );
      setTeacherForm({
        fullName: "",
        email: "",
        phone: "",
        password: "",
      });
      showToast({
        title: t("settings.teacherCreated"),
        description: t("settings.teacherCreatedDescription"),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("settings.teacherCreateFailed"),
        description: error.message,
        tone: "error",
      });
    } finally {
      setCreatingTeacher(false);
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

      {user.role === "ADMIN" ? (
        <section className="panel stack-lg">
          <div className="stack-sm">
            <h2>{t("settings.teachersTitle")}</h2>
            <p>{t("settings.teachersDescription")}</p>
          </div>

          <form className="stack-lg" onSubmit={handleTeacherSubmit}>
            <div className="form-grid">
              <label className="field">
                <span>{t("settings.fullName")}</span>
                <input
                  name="fullName"
                  value={teacherForm.fullName}
                  onChange={handleTeacherChange}
                  placeholder={t("login.fullNamePlaceholder")}
                  required
                />
              </label>
              <label className="field">
                <span>{t("settings.email")}</span>
                <input
                  type="email"
                  name="email"
                  value={teacherForm.email}
                  onChange={handleTeacherChange}
                  placeholder={t("login.emailPlaceholder")}
                  required
                />
              </label>
              <label className="field">
                <span>{t("settings.phone")}</span>
                <input
                  type="tel"
                  name="phone"
                  value={teacherForm.phone}
                  onChange={handleTeacherChange}
                  placeholder={t("settings.phonePlaceholder")}
                  required
                />
              </label>
              <label className="field">
                <span>{t("settings.teacherPassword")}</span>
                <div className="password-field">
                  <input
                    type={showTeacherPassword ? "text" : "password"}
                    name="password"
                    value={teacherForm.password}
                    onChange={handleTeacherChange}
                    placeholder={t("login.passwordPlaceholder")}
                    required
                  />
                  <button
                    type="button"
                    className="password-field__toggle"
                    onClick={() => setShowTeacherPassword((current) => !current)}
                    aria-label={
                      showTeacherPassword
                        ? t("common.hidePassword")
                        : t("common.showPassword")
                    }
                    title={
                      showTeacherPassword
                        ? t("common.hidePassword")
                        : t("common.showPassword")
                    }
                  >
                    {showTeacherPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            </div>

            <button
              type="submit"
              className="button button--primary"
              disabled={creatingTeacher}
            >
              {creatingTeacher ? t("settings.creatingTeacher") : t("settings.createTeacher")}
            </button>
          </form>

          <div className="stack-md">
            {loadingTeachers ? (
              <p className="helper-text">{t("settings.loadingTeachers")}</p>
            ) : teachers.length ? (
              teachers.map((teacher) => (
                <div key={teacher.id} className="list-row">
                  <div>
                    <strong>{teacher.fullName}</strong>
                    <span>{teacher.phone || teacher.email}</span>
                  </div>
                  <div>
                    <strong>{teacher.email}</strong>
                    <span>{t("roles.TEACHER")}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="helper-text">{t("settings.noTeachers")}</p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
