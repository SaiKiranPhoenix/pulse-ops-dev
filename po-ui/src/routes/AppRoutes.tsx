import { Route, Routes } from "react-router-dom";
import { LoginPage } from "@/pages/auth/LoginPage";
import { OAuthCallbackPage } from "@/pages/auth/OAuthCallbackPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { AlertsPage } from "@/pages/dashboard/AlertsPage";
import { ApiKeysPage } from "@/pages/dashboard/ApiKeysPage";
import { DashboardLayout } from "@/pages/dashboard/DashboardLayout";
import { LogsPage } from "@/pages/dashboard/LogsPage";
import { MetricsPage } from "@/pages/dashboard/MetricsPage";
import { OverviewPage } from "@/pages/dashboard/OverviewPage";
import { SetupPage } from "@/pages/dashboard/SetupPage";
import { TracesPage } from "@/pages/dashboard/TracesPage";
import { VaultAuditPage } from "@/pages/dashboard/VaultAuditPage";
import { VaultPage } from "@/pages/dashboard/VaultPage";
import { WorkersPage } from "@/pages/dashboard/WorkersPage";
import { LandingPage } from "@/pages/LandingPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ProtectedRoute } from "./ProtectedRoute";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="setup" element={<SetupPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="metrics" element={<MetricsPage />} />
          <Route path="traces" element={<TracesPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="workers" element={<WorkersPage />} />
          <Route path="vault" element={<VaultPage />} />
          <Route path="vault-audit" element={<VaultAuditPage />} />
          <Route path="api-keys" element={<ApiKeysPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
