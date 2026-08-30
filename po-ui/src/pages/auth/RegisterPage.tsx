import { Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthSplitLayout } from "@/features/auth/components/AuthSplitLayout";
import { AuthSocialButtons } from "@/features/auth/components/AuthSocialButtons";
import { register } from "@/features/auth/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      navigate("/dashboard/setup", { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout
      description="Create your operator account, generate project API keys, and start sending logs, errors, and metrics into PulseOps."
      eyebrow="Start the demo"
      title="Create your PulseOps account"
    >
      <AuthSocialButtons />

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
            minLength={8}
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
        <Link
          className="inline-flex min-h-11 min-w-12 items-center justify-center font-medium text-primary hover:underline"
          to="/login"
        >
          Sign in
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
