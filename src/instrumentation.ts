export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkEnv } = await import("./lib/env");
    const { errors, warnings } = checkEnv();
    for (const w of warnings) console.warn(`[config] ${w}`);
    if (errors.length) throw new Error(`Missing production settings (see DEPLOY.md):\n- ${errors.join("\n- ")}`);
    const { ensureMigrated } = await import("./lib/db");
    await ensureMigrated();
  }
}
