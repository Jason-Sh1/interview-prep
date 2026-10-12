import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { SignOutButton } from "./SignOutButton";

export async function Nav() {
  const user = await getCurrentUser();
  return (
    <header className="border-b border-line bg-surface">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4">
        <Link href={user ? "/today" : "/"} className="mr-4 font-semibold tracking-tight">
          Interview Prep
        </Link>
        {user && (
          <>
            <Link href="/today" className="btn-ghost">Today</Link>
            <Link href="/problems" className="btn-ghost">Problems</Link>
            <Link href="/mock" className="btn-ghost">Mock interview</Link>
            <Link href="/progress" className="btn-ghost">Skill map</Link>
            <Link href="/onboarding" className="btn-ghost">Goals</Link>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-muted sm:inline">{user.name}</span>
              <SignOutButton />
            </>
          ) : (
            <Link href="/signin" className="btn-primary">Sign in</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
