import { Navigate, Outlet } from "react-router-dom";

export function ProtectedRoute() {
  const token = window.localStorage.getItem("pulseops.accessToken");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
