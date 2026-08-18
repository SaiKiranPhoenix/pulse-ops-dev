import { Loader2 } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthSplitLayout } from "@/features/auth/components/AuthSplitLayout";
import { AuthSocialButtons } from "@/features/auth/components/AuthSocialButtons";
import { login } from "@/features/auth/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const oauthError = searchParams.get("oauth_error");
  const statusMessage = useMemo(() => {
    if (oauthError !== null) {
      return oauthError;
    }

    return searchParams.get("registered") === "1" ? "Account created. Sign in to continue." : null;
  }, [oauthError, searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout
      description="Access project telemetry, incident signals, queue health, and vault activity from one operational dashboard."
      eyebrow="Welcome back"
      title="Sign in to PulseOps"
    >
      {statusMessage !== null ? (
        <div className="mb-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {statusMessage}
        </div>
      ) : null}

      <AuthSocialButtons />

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>Email</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium">
          Email
          <Input
            autoComplete="email"
            className="mt-2"
            maxLength={320}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            required
            type="email"
            value={email}
          />
        </label>

        <label className="block text-sm font-medium">
          Password
          <Input
            autoComplete="current-password"
            className="mt-2"
            maxLength={128}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            required
            type="password"
            value={password}
          />
        </label>

        {error !== null ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button
          disabled={isSubmitting}
          icon={isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          type="submit"
        >
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link className="font-medium text-primary hover:underline" to="/register">
          Create one
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
