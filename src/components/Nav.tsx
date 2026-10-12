import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { pendingCount } from "@/lib/research";
import { isAdmin } from "@/lib/research/admin";
import { SignOutButton } from "./SignOutButton";

export async function Nav() {
  const user = await getCurrentUser();
  const admin = user ? isAdmin(user.email) : false;
  const pending = admin ? await pendingCount().catch(() => 0) : 0;
  return (
    <header className="border-b border-line bg-surface">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4">
        <Link href={user ? "/today" : "/"} className="mr-4 shrink-0 font-semibold tracking-tight">
          Interview Prep
        </Link>
        {user && (
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
            <Link href="/today" className="btn-ghost">Today</Link>
            <Link href="/problems" className="btn-ghost">Problems</Link>
            <Link href="/mock" className="btn-ghost">Mock interview</Link>
            <Link href="/assisted" className="btn-ghost">AI-assisted</Link>
            <Link href="/progress" className="btn-ghost">Skill map</Link>
            <Link href="/onboarding" className="btn-ghost">Goals</Link>
            {admin && (
              <Link href="/research" className="btn-ghost">
                Research{pending > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 text-xs text-white">{pending}</span>}
              </Link>
            )}
          </div>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
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
