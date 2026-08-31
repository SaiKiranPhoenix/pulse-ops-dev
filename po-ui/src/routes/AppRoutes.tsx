import { Route, Routes } from "react-router-dom";
import { LoginPage } from "@/pages/auth/LoginPage";
import { OAuthCallbackPage } from "@/pages/auth/OAuthCallbackPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { AccountPage } from "@/pages/dashboard/AccountPage";
import { AlertsPage } from "@/pages/dashboard/AlertsPage";
import { ApiKeysPage } from "@/pages/dashboard/ApiKeysPage";
import { CustomDashboardsPage } from "@/pages/dashboard/CustomDashboardsPage";
import { DashboardLayout } from "@/pages/dashboard/DashboardLayout";
import { ErrorsPage } from "@/pages/dashboard/ErrorsPage";
import { InfrastructurePage } from "@/pages/dashboard/InfrastructurePage";
import { LogsPage } from "@/pages/dashboard/LogsPage";
import { MetricsPage } from "@/pages/dashboard/MetricsPage";
import { OrganizationPage } from "@/pages/dashboard/OrganizationPage";
import { OverviewPage } from "@/pages/dashboard/OverviewPage";
import { PlatformPage } from "@/pages/dashboard/PlatformPage";
import { ProjectSettingsPage } from "@/pages/dashboard/ProjectSettingsPage";
import { QueryExplorerPage } from "@/pages/dashboard/QueryExplorerPage";
import { ServiceDetailPage } from "@/pages/dashboard/ServiceDetailPage";
import { ServicesPage } from "@/pages/dashboard/ServicesPage";
import { SetupPage } from "@/pages/dashboard/SetupPage";
import { SloPage } from "@/pages/dashboard/SloPage";
import { TracesPage } from "@/pages/dashboard/TracesPage";
import { VaultAuditPage } from "@/pages/dashboard/VaultAuditPage";
import { VaultPage } from "@/pages/dashboard/VaultPage";
import { WorkersPage } from "@/pages/dashboard/WorkersPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ProductEntryRoute } from "./ProductEntryRoute";
import { ProtectedRoute } from "./ProtectedRoute";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ProductEntryRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="custom" element={<CustomDashboardsPage />} />
          <Route path="explorer" element={<QueryExplorerPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="services/:serviceName" element={<ServiceDetailPage />} />
          <Route path="setup" element={<SetupPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="errors" element={<ErrorsPage />} />
          <Route path="metrics" element={<MetricsPage />} />
          <Route path="traces" element={<TracesPage />} />
          <Route path="infrastructure" element={<InfrastructurePage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="slos" element={<SloPage />} />
          <Route path="workers" element={<WorkersPage />} />
          <Route path="vault" element={<VaultPage />} />
          <Route path="vault-audit" element={<VaultAuditPage />} />
          <Route path="api-keys" element={<ApiKeysPage />} />
          <Route path="organization" element={<OrganizationPage />} />
          <Route path="projects" element={<ProjectSettingsPage />} />
          <Route path="platform" element={<PlatformPage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
