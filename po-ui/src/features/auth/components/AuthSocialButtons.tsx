import { Github } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getOAuthStartUrl, type OAuthProvider } from "@/features/auth/api";

const socialProviders: ReadonlyArray<{
  readonly provider: OAuthProvider;
  readonly label: string;
  readonly icon: ReactNode;
}> = [
  {
    provider: "google",
    label: "Continue with Google",
    icon: <span className="text-sm font-semibold">G</span>,
  },
  {
    provider: "github",
    label: "Continue with GitHub",
    icon: <Github aria-hidden="true" className="h-4 w-4" />,
  },
];

export function AuthSocialButtons() {
  const [providerState, setProviderState] = useState<OAuthProvider | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  async function handleSocialSignIn(provider: OAuthProvider): Promise<void> {
    setProviderState(provider);
    setSetupError(null);

    try {
      const response = await fetch(getOAuthStartUrl(provider), {
        method: "GET",
        redirect: "manual",
      });

      if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
        window.location.assign(getOAuthStartUrl(provider));
        return;
      }

      if (response.redirected) {
        window.location.assign(response.url);
        return;
      }

      if (!response.ok) {
        setSetupError(
          `${provider} OAuth is not configured. Add local provider credentials or use email sign-in.`,
        );
        return;
      }

      window.location.assign(getOAuthStartUrl(provider));
    } catch {
      setSetupError(
        "OAuth setup could not be checked. Use email sign-in or retry after the API is up.",
      );
    } finally {
      setProviderState(null);
    }
  }

  return (
    <div className="grid gap-3">
      {socialProviders.map((item) => (
        <Button
          key={item.provider}
          icon={item.icon}
          type="button"
          variant="outline"
          disabled={providerState !== null}
          onClick={() => {
            void handleSocialSignIn(item.provider);
          }}
        >
          {providerState === item.provider ? "Checking provider..." : item.label}
        </Button>
      ))}
      {setupError !== null ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {setupError}
        </p>
      ) : null}
    </div>
  );
}
