import { Github } from "lucide-react";
import type { ReactNode } from "react";
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
  function handleSocialSignIn(provider: OAuthProvider): void {
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
          onClick={() => {
            handleSocialSignIn(item.provider);
          }}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
