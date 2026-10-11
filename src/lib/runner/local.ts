// Runs a program with the local `node` or `python3` binary. Used by the test
// suite and the bank validation script only; the app never runs user code on
// its own server (it uses Judge0 or the browser runner).

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Signature, TestCase } from "../problems/types";
import { gradeOutput, type RunOutcome } from "./compare";
import { buildProgram, type Language } from "./drivers";

export function runLocally(
  sig: Signature,
  lang: Language,
  code: string,
  tests: TestCase[],
  timeoutMs = 10_000,
): RunOutcome {
  const dir = mkdtempSync(join(tmpdir(), "ip-run-"));
  try {
    const file = join(dir, lang === "javascript" ? "main.js" : "main.py");
    writeFileSync(file, buildProgram(sig, lang, code, tests));
    const res = spawnSync(lang === "javascript" ? "node" : "python3", [file], {
      timeout: timeoutMs,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    const timedOut = res.error?.message.includes("ETIMEDOUT") ?? false;
    return gradeOutput(sig, tests, res.stdout ?? "", res.stderr ?? "", "local", { timedOut });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
