import { Loader2, Save, ShieldCheck, UserRound } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { getCurrentUser, updateCurrentUser, type CurrentUser } from "@/features/auth/api";
import { getAccessToken, getApiErrorMessage } from "@/lib/api-client";

export function AccountPage() {
  const { notify } = useToast();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const accessToken = getAccessToken();

  useEffect(() => {
    let isMounted = true;

    async function loadAccount(): Promise<void> {
      try {
        const currentUser = await getCurrentUser();

        if (isMounted) {
          setUser(currentUser);
          setName(currentUser.name ?? "");
          setError(null);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(getApiErrorMessage(requestError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadAccount();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const updatedUser = await updateCurrentUser({
        name: name.trim().length === 0 ? null : name,
      });
      setUser(updatedUser);
      setName(updatedUser.name ?? "");
      notify({ title: "Profile updated", variant: "success" });
    } catch (requestError) {
      const message = getApiErrorMessage(requestError);
      setError(message);
      notify({ title: "Profile update failed", description: message, variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <div className="h-24 animate-pulse rounded-md bg-slate-200" />
        <div className="h-56 animate-pulse rounded-md bg-slate-200" />
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-cyan-50 text-cyan-800">
            <UserRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-950">Profile</h2>
            <p className="text-sm text-slate-600">{user?.email ?? "Signed-in operator"}</p>
          </div>
        </div>

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-800">
            Display name
            <Input
              autoComplete="name"
              className="mt-2"
              maxLength={80}
              onChange={(event) => {
                setName(event.target.value);
              }}
              placeholder="Name shown in the product shell"
              value={name}
            />
          </label>

          {error === null ? null : (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button
            className="w-full sm:w-auto"
            disabled={isSaving}
            icon={
              isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />
            }
            type="submit"
          >
            Save profile
          </Button>
        </form>
      </section>

      <aside className="grid gap-5">
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-emerald-800">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-950">Session</h2>
              <p className="text-sm text-slate-600">Bearer token stored locally</p>
            </div>
          </div>

          <div className="mt-4 rounded-md bg-slate-50 p-3 font-mono text-xs text-slate-600">
            {accessToken === null ? "No active token" : `${accessToken.slice(0, 18)}...`}
          </div>
          {accessToken === null ? null : (
            <CopyButton className="mt-3" label="Copy token" value={accessToken} />
          )}
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Password Reset</h2>
          <p className="mt-2">
            Password reset is intentionally outside the local demo. Create another local account or
            update credentials directly in the development database.
          </p>
        </section>
      </aside>
    </div>
  );
}
