import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setAccessToken } from "@/lib/api-client";

export function OAuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const tokenType = params.get("token_type");

    window.history.replaceState(null, "", "/oauth/callback");

    if (accessToken === null || tokenType !== "Bearer") {
      navigate("/login?oauth_error=OAuth%20sign-in%20failed", { replace: true });
      return;
    }

    setAccessToken(accessToken);
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <p className="text-sm text-muted-foreground">Completing sign-in...</p>
    </main>
  );
}
