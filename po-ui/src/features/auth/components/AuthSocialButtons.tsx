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

  function handleSocialSignIn(provider: OAuthProvider): void {
    setProviderState(provider);
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
            handleSocialSignIn(item.provider);
          }}
        >
          {providerState === item.provider ? "Redirecting..." : item.label}
        </Button>
      ))}
    </div>
  );
}
