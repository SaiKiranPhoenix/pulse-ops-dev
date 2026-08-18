import { Github, Loader2 } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getOAuthStartUrl, register, type OAuthProvider } from "@/features/auth/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await register({
        email,
        password,
        ...(name.trim().length > 0 ? { name } : {}),
      });
      navigate("/login?registered=1", { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSocialSignIn(provider: OAuthProvider): void {
    window.location.assign(getOAuthStartUrl(provider));
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              PulseOps
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Create account</h1>
          </div>

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

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>Email</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium">
              Name
              <Input
                autoComplete="name"
                className="mt-2"
                maxLength={80}
                onChange={(event) => {
                  setName(event.target.value);
                }}
                type="text"
                value={name}
              />
            </label>

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
                autoComplete="new-password"
                className="mt-2"
                maxLength={128}
                minLength={12}
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
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already registered?{" "}
            <Link className="font-medium text-primary hover:underline" to="/login">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
