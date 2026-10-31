import { authMode } from "./auth/mode";

// Checks the settings a hosted deploy needs, at server start. Errors stop the
// server with a clear message (better than running insecurely or losing data);
// warnings are logged. Pure: takes the environment, returns findings.

export interface EnvCheck {
  errors: string[];
  warnings: string[];
}

export function checkEnv(env: Record<string, string | undefined> = process.env): EnvCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const production = env.NODE_ENV === "production";
  const onVercel = !!env.VERCEL;
  const accounts = authMode() === "accounts";

  if (onVercel && !env.DATABASE_URL) {
    errors.push("DATABASE_URL is required on Vercel: the embedded database can't persist there. Set it to your Neon connection string.");
  }
  if (accounts && production) {
    const secret = env.BETTER_AUTH_SECRET ?? "";
    if (secret.length < 32) errors.push("BETTER_AUTH_SECRET must be set to a random string of at least 32 characters (openssl rand -base64 32).");
    if (!env.BETTER_AUTH_URL && !env.VERCEL_PROJECT_PRODUCTION_URL) {
      errors.push("BETTER_AUTH_URL must be set to the site's address, e.g. https://your-app.vercel.app.");
    }
    if (!env.SIGNUP_INVITE_CODE) {
      warnings.push("SIGNUP_INVITE_CODE is not set, so anyone who finds the site can create an account (and use your API key).");
    }
  }
  if (onVercel && !accounts) {
    warnings.push("AUTH_MODE=single on Vercel: anyone with the address can use the app as you. Remove AUTH_MODE to require accounts.");
  }
  if (onVercel && !env.CRON_SECRET) {
    warnings.push("CRON_SECRET is not set, so the research and retention jobs won't run.");
  }
  return { errors, warnings };
}
