"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { INVITE_HEADER } from "@/lib/auth/invite-header";

export function SignInForm({ initialMode, github, invite }: { initialMode: "signin" | "signup"; github: boolean; invite: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    setPending(true);
    setError(null);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const res =
      mode === "signup"
        ? await authClient.signUp.email({
            email,
            password,
            name: String(form.get("name") || email.split("@")[0]),
            fetchOptions: { headers: { [INVITE_HEADER]: String(form.get("invite") ?? "") } },
          })
        : await authClient.signIn.email({ email, password });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? "Something went wrong");
      return;
    }
    router.push(mode === "signup" ? "/onboarding" : "/today");
    router.refresh();
  }

  return (
    <div className="card p-6">
      <h1 className="text-xl font-semibold">{mode === "signup" ? "Create your account" : "Sign in"}</h1>
      <form action={submit} className="mt-5 space-y-4">
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input className="input" id="name" name="name" autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            className="input"
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </div>
        {mode === "signup" && invite && (
          <div>
            <label className="label" htmlFor="invite">Invite code</label>
            <input className="input" id="invite" name="invite" required autoComplete="off" />
            <p className="mt-1 text-xs text-muted">Sign-up is invite-only for now. Ask whoever shared this site with you.</p>
          </div>
        )}
        {mode === "signup" && (
          <p className="text-xs text-muted">
            By creating an account you agree to how we handle your data, described in the{" "}
            <Link href="/privacy" className="text-accent hover:underline">privacy page</Link>.
          </p>
        )}
        {error && <p className="text-sm text-bad">{error}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
      {github && !(mode === "signup" && invite) && (
        <button
          className="btn-secondary mt-3 w-full"
          onClick={() => authClient.signIn.social({ provider: "github", callbackURL: "/today" })}
        >
          Continue with GitHub
        </button>
      )}
      <p className="mt-5 text-center text-sm text-muted">
        {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
        <button className="text-accent hover:underline" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "Sign in" : "Create an account"}
        </button>
      </p>
    </div>
  );
}
