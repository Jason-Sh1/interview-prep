"use client";
import { authClient } from "@/lib/auth/client";

// Links GitHub to a signed-in email account. Better Auth only links when
// GitHub reports the same email as verified; the link then marks the account's
// email verified (lib/auth/github-link.ts), which admin pages (ADMIN_EMAILS) need.
export function LinkGitHub() {
  return (
    <button className="btn-secondary" onClick={() => authClient.linkSocial({ provider: "github", callbackURL: "/settings" })}>
      Link GitHub
    </button>
  );
}
