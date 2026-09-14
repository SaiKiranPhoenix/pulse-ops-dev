import { Navigate } from "react-router-dom";
import { getAccessToken } from "@/lib/api-client";
import { LandingPage } from "@/pages/LandingPage";

export function ProductEntryRoute() {
  return getAccessToken() === null ? <LandingPage /> : <Navigate to="/dashboard" replace />;
}
