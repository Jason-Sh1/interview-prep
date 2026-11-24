// Per-IP limits on the auth endpoints (Better Auth counts per client IP and
// path, in the rate_limit table). Sized for a club whose members often share
// one address (campus Wi-Fi, a meetup): forty people should be able to sign
// up in the same hour and sign in at the same minute. The invite code, not the
// limit, is what keeps strangers out of sign-up; the sign-in limit still caps
// password guessing from one address at 30 tries a minute.

export const AUTH_RATE_LIMITS = {
  "/sign-in/email": { window: 60, max: 30 },
  "/sign-up/email": { window: 3600, max: 60 },
} as const;
