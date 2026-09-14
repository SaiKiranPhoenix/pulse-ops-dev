import { Github } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  checkApiGatewayHealth,
  getApiBaseUrl,
  getOAuthStartUrl,
  type OAuthProvider,
} from "@/features/auth/api";

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

    const isApiReachable = await checkApiGatewayHealth();

    if (!isApiReachable) {
      setSetupError(
        `PulseOps API gateway is not reachable at ${formatApiBaseUrl()}. Start the backend stack, then retry Google sign-in.`,
      );
      setProviderState(null);
      return;
    }

    window.location.assign(getOAuthStartUrl(provider));
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
          {providerState === item.provider ? "Redirecting..." : item.label}
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

function formatApiBaseUrl(): string {
  const apiBaseUrl = getApiBaseUrl();
  return apiBaseUrl.length > 0 ? apiBaseUrl : "the configured API gateway";
}
