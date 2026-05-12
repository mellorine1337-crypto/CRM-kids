// Кратко: описывает дерево маршрутов frontend и связывает страницы с layout.
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { DashboardLayout } from "./layouts/DashboardLayout.jsx";
import { AttendancePage } from "./pages/AttendancePage.jsx";
import { AnalyticsPage } from "./pages/AnalyticsPage.jsx";
import { ChildrenPage } from "./pages/ChildrenPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { EnrollmentsPage } from "./pages/EnrollmentsPage.jsx";
import { FeedbackPage } from "./pages/FeedbackPage.jsx";
import { IntegrationsPage } from "./pages/IntegrationsPage.jsx";
import { JournalPage } from "./pages/JournalPage.jsx";
import { LessonsPage } from "./pages/LessonsPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { NotificationsPage } from "./pages/NotificationsPage.jsx";
import { PaymentsPage } from "./pages/PaymentsPage.jsx";
import { RecommendationsPage } from "./pages/RecommendationsPage.jsx";
import { SettingsPage } from "./pages/SettingsPage.jsx";

// Служебная функция App: инкапсулирует отдельный шаг логики этого модуля.
function App() {
  return (
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
  );
}

export default App;
