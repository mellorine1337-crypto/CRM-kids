// Кратко: описывает дерево маршрутов frontend и связывает страницы с layout.
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
const DashboardLayout = lazy(() =>
  import("./layouts/DashboardLayout.jsx").then((module) => ({ default: module.DashboardLayout })),
);
const AttendancePage = lazy(() =>
  import("./pages/AttendancePage.jsx").then((module) => ({ default: module.AttendancePage })),
);
const AnalyticsPage = lazy(() =>
  import("./pages/AnalyticsPage.jsx").then((module) => ({ default: module.AnalyticsPage })),
);
const ChildrenPage = lazy(() =>
  import("./pages/ChildrenPage.jsx").then((module) => ({ default: module.ChildrenPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage.jsx").then((module) => ({ default: module.DashboardPage })),
);
const EnrollmentsPage = lazy(() =>
  import("./pages/EnrollmentsPage.jsx").then((module) => ({ default: module.EnrollmentsPage })),
);
const FeedbackPage = lazy(() =>
  import("./pages/FeedbackPage.jsx").then((module) => ({ default: module.FeedbackPage })),
);
const IntegrationsPage = lazy(() =>
  import("./pages/IntegrationsPage.jsx").then((module) => ({ default: module.IntegrationsPage })),
);
const JournalPage = lazy(() =>
  import("./pages/JournalPage.jsx").then((module) => ({ default: module.JournalPage })),
);
const LessonsPage = lazy(() =>
  import("./pages/LessonsPage.jsx").then((module) => ({ default: module.LessonsPage })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage.jsx").then((module) => ({ default: module.LoginPage })),
);
const NotificationsPage = lazy(() =>
  import("./pages/NotificationsPage.jsx").then((module) => ({ default: module.NotificationsPage })),
);
const PaymentsPage = lazy(() =>
  import("./pages/PaymentsPage.jsx").then((module) => ({ default: module.PaymentsPage })),
);
const RecommendationsPage = lazy(() =>
  import("./pages/RecommendationsPage.jsx").then((module) => ({ default: module.RecommendationsPage })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage.jsx").then((module) => ({ default: module.SettingsPage })),
);

const RouteLoader = () => (
  <div className="screen-loader">
    <div className="spinner" />
    <span>Загрузка...</span>
  </div>
);

// Служебная функция App: инкапсулирует отдельный шаг логики этого модуля.
function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
          <Route path="children" element={<ChildrenPage />} />
          <Route path="lessons" element={<LessonsPage />} />
          <Route path="enrollments" element={<EnrollmentsPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="feedback" element={<FeedbackPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
