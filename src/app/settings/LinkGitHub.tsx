"use client";
import { authClient } from "@/lib/auth/client";

// Links GitHub to a signed-in email account. When the GitHub email matches, the
// account's email counts as verified, which admin pages (ADMIN_EMAILS) need.
export function LinkGitHub() {
  return (
    <button className="btn-secondary" onClick={() => authClient.linkSocial({ provider: "github", callbackURL: "/settings" })}>
      Link GitHub
    </button>
  );
}
