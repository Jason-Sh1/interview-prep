import "server-only";
// Runs programs on a Judge0 instance (spec section 5). Enabled by JUDGE0_URL.
// Self-hosted Judge0 can use JUDGE0_AUTH_TOKEN; the RapidAPI-hosted version
// uses JUDGE0_RAPIDAPI_KEY.

import type { Signature, TestCase } from "../problems/types";
import { gradeOutput, type RunOutcome } from "./compare";
import { buildProgram, remapLineNumbers, type Language } from "./drivers";

export function judge0Enabled(): boolean {
  return !!process.env.JUDGE0_URL;
}

// Judge0 CE defaults: 71 = Python 3.8, 63 = JavaScript (Node 12). Newer
// language versions have other ids; override with these variables.
function languageId(lang: Language): number {
  return lang === "python"
    ? Number(process.env.JUDGE0_LANG_PYTHON || 71)
    : Number(process.env.JUDGE0_LANG_JAVASCRIPT || 63);
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const unb64 = (s: string | null | undefined) => (s ? Buffer.from(s, "base64").toString("utf8") : "");

export async function runOnJudge0(
  sig: Signature,
  lang: Language,
  code: string,
  tests: TestCase[],
): Promise<RunOutcome> {
  const base = process.env.JUDGE0_URL!.replace(/\/$/, "");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.JUDGE0_AUTH_TOKEN) headers["X-Auth-Token"] = process.env.JUDGE0_AUTH_TOKEN;
  if (process.env.JUDGE0_RAPIDAPI_KEY) {
    headers["X-RapidAPI-Key"] = process.env.JUDGE0_RAPIDAPI_KEY;
    headers["X-RapidAPI-Host"] = new URL(base).host;
  }
  const res = await fetch(`${base}/submissions?base64_encoded=true&wait=true`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source_code: b64(buildProgram(sig, lang, code, tests)),
      language_id: languageId(lang),
      cpu_time_limit: 5,
      wall_time_limit: 10,
      memory_limit: 256000,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    return {
      verdict: "internal_error",
      results: [],
      passed: 0,
      total: tests.length,
      message: `Judge0 returned ${res.status}`,
      runner: "judge0",
    };
  }
  const body = (await res.json()) as {
    stdout?: string;
    stderr?: string;
    compile_output?: string;
    status?: { id: number; description: string };
  };
  const statusId = body.status?.id ?? 0;
  const fix = (t: string) => remapLineNumbers(t, lang);
  const outcome = gradeOutput(sig, tests, unb64(body.stdout), fix(unb64(body.stderr)), "judge0", {
    timedOut: statusId === 5,
    compileError: statusId === 6 ? fix(unb64(body.compile_output)) : undefined,
  });
  for (const r of outcome.results) if (r.error) r.error = fix(r.error);
  return outcome;
}
