import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { getCurrentUser } from "@/features/auth/api";
import { getAccessToken, subscribeToSessionExpired } from "@/lib/api-client";

export function ProtectedRoute() {
  const navigate = useNavigate();
  const token = getAccessToken();
  const [sessionState, setSessionState] = useState<"checking" | "expired" | "valid">(
    token === null ? "expired" : "checking",
  );

  useEffect(() => {
    const unsubscribe = subscribeToSessionExpired(() => {
      setSessionState("expired");
      navigate("/login?session_expired=1", { replace: true });
    });

    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (token === null) {
      setSessionState("expired");
      return;
    }

    let isMounted = true;

    async function verifySession(): Promise<void> {
      try {
        await getCurrentUser();

        if (isMounted) {
          setSessionState("valid");
        }
      } catch {
        if (isMounted) {
          setSessionState("expired");
        }
      }
    }

    void verifySession();

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (sessionState === "checking") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-6 text-sm text-slate-600">
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Restoring session...
        </div>
      </main>
    );
  }

  if (sessionState === "expired") {
    return <Navigate to="/login?session_expired=1" replace />;
  }

  return <Outlet />;
}
