import { Route, Routes } from "react-router-dom";
import { LoginPage } from "@/pages/auth/LoginPage";
import { OAuthCallbackPage } from "@/pages/auth/OAuthCallbackPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { AlertsPage } from "@/pages/dashboard/AlertsPage";
import { LogsPage } from "@/pages/dashboard/LogsPage";
import { MetricsPage } from "@/pages/dashboard/MetricsPage";
import { OverviewPage } from "@/pages/dashboard/OverviewPage";
import { TracesPage } from "@/pages/dashboard/TracesPage";
import { VaultPage } from "@/pages/dashboard/VaultPage";
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
        <Route path="/dashboard" element={<OverviewPage />} />
        <Route path="/dashboard/logs" element={<LogsPage />} />
        <Route path="/dashboard/metrics" element={<MetricsPage />} />
        <Route path="/dashboard/traces" element={<TracesPage />} />
        <Route path="/dashboard/alerts" element={<AlertsPage />} />
        <Route path="/dashboard/vault" element={<VaultPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
