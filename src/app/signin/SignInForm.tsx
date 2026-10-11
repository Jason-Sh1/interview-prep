"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function SignInForm({ initialMode, github }: { initialMode: "signin" | "signup"; github: boolean }) {
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
        ? await authClient.signUp.email({ email, password, name: String(form.get("name") || email.split("@")[0]) })
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
        {error && <p className="text-sm text-bad">{error}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
      {github && (
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
