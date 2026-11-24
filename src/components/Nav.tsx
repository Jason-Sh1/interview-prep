import Link from "next/link";
import { isSingleUser } from "@/lib/auth/mode";
import { getCurrentUser } from "@/lib/auth/session";
import { pendingCount } from "@/lib/research";
import { isAdmin } from "@/lib/research/admin";
import { NavMenu } from "./NavMenu";
import { SignOutButton } from "./SignOutButton";

export async function Nav() {
  const user = await getCurrentUser();
  const admin = user ? isAdmin(user) : false;
  const pending = admin ? await pendingCount().catch(() => 0) : 0;
  const links = [
    { href: "/today", label: "Today" },
    { href: "/problems", label: "Problems" },
    { href: "/mock", label: "Mock interview" },
    { href: "/rounds", label: "Rounds", match: ["/rounds", "/assisted", "/debug", "/design", "/behavioral", "/walkthrough"] },
    { href: "/progress", label: "Skill map" },
    { href: "/onboarding", label: "Goals" },
    { href: "/settings", label: "Settings" },
    ...(admin ? [{ href: "/research", label: "Research", badge: pending || undefined }, { href: "/stats", label: "Usage" }] : []),
  ];
  return (
    <header className="border-b border-line bg-surface">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4">
        <Link href={user ? "/today" : "/"} className="mr-4 shrink-0 font-semibold tracking-tight">
          Interview Prep
        </Link>
        {user && (
          <>
            {/* Wide screens: every link inline. Narrow screens: a menu. */}
            <div className="hidden min-w-0 items-center gap-1 whitespace-nowrap xl:flex">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="btn-ghost">
                  {l.label}
                  {l.badge && <span className="ml-1 rounded-full bg-accent px-1.5 text-xs text-white">{l.badge}</span>}
                </Link>
              ))}
            </div>
            <NavMenu links={links} />
          </>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
          {user && isSingleUser() ? null : user ? (
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
