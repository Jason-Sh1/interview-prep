"use client";
// Runs programs in the browser: JavaScript in a Web Worker, Python with
// Pyodide (CPython compiled to WebAssembly) in a Web Worker. User code never
// touches the server, and a stuck program is stopped by terminating its worker.

import type { Signature, TestCase } from "../problems/types";
import { gradeOutput, type RunOutcome } from "./compare";
import { buildProgram, remapLineNumbers, type Language } from "./drivers";

// Served from public/vendor (see scripts/copy-vendor.mjs).
export const PYODIDE_URL = "/vendor/pyodide/";
const TIME_LIMIT_MS = 10_000;
// Pyodide needs a few seconds to load the first time.
const PYTHON_FIRST_LOAD_MS = 60_000;

const JS_WORKER = `
self.onmessage = function (e) {
  var out = [];
  console.log = function () { out.push(Array.prototype.slice.call(arguments).map(function (x) { return typeof x === "string" ? x : JSON.stringify(x); }).join(" ")); };
  var stderr = "";
  try { (new Function(e.data.program))(); }
  catch (err) { stderr = (err && err.stack) ? String(err.stack) : String(err); if (err && err.name === "SyntaxError") stderr = "SyntaxError: " + err.message; }
  self.postMessage({ stdout: out.join("\\n"), stderr: stderr });
};`;

// Blob workers can't resolve relative URLs, so the base URL is passed in absolute.
const pyWorkerSource = (base: string) => `
importScripts("${base}pyodide.js");
var ready = loadPyodide({ indexURL: "${base}" });
self.onmessage = async function (e) {
  var py = await ready;
  var out = [];
  py.setStdout({ batched: function (s) { out.push(s); } });
  py.setStderr({ batched: function (s) { out.push(s); } });
  var stderr = "";
  try {
    // Fresh globals per run so definitions from an earlier run don't leak in.
    var ns = py.globals.get("dict")();
    await py.runPythonAsync(e.data.program, { globals: ns });
    ns.destroy();
  } catch (err) { stderr = String(err && err.message ? err.message : err); }
  self.postMessage({ stdout: out.join("\\n"), stderr: stderr });
};`;

const pyodideBase = () => new URL(PYODIDE_URL, window.location.href).href;

let pyWorker: Worker | null = null;
let pyLoaded = false;

function makeWorker(source: string): Worker {
  return new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
}

/** Starts loading Python ahead of the first run. */
export function preloadPython() {
  if (!pyWorker) pyWorker = makeWorker(pyWorkerSource(pyodideBase()));
}

function execute(lang: Language, program: string): Promise<{ stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const isPy = lang === "python";
    const worker = isPy ? (pyWorker ??= makeWorker(pyWorkerSource(pyodideBase()))) : makeWorker(JS_WORKER);
    const limit = isPy && !pyLoaded ? PYTHON_FIRST_LOAD_MS : TIME_LIMIT_MS;
    const timer = setTimeout(() => {
      worker.terminate();
      if (isPy) {
        pyWorker = null;
        pyLoaded = false;
      }
      resolve({ stdout: "", stderr: "", timedOut: true });
    }, limit);
    worker.onmessage = (e: MessageEvent<{ stdout: string; stderr: string }>) => {
      clearTimeout(timer);
      if (isPy) pyLoaded = true;
      else worker.terminate();
      resolve({ ...e.data, timedOut: false });
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      if (isPy) pyWorker = null;
      resolve({ stdout: "", stderr: e.message || "Could not start the runner", timedOut: false });
    };
    worker.postMessage({ program });
  });
}

export async function runInBrowser(
  sig: Signature,
  lang: Language,
  code: string,
  tests: TestCase[],
): Promise<RunOutcome> {
  const program = buildProgram(sig, lang, code, tests);
  const res = await execute(lang, program);
  // new Function adds two wrapper lines before the body.
  const fix = (t: string) => remapLineNumbers(t, lang, lang === "javascript" ? 2 : 0);
  const outcome = gradeOutput(sig, tests, res.stdout, fix(res.stderr), "browser", { timedOut: res.timedOut });
  for (const r of outcome.results) if (r.error) r.error = fix(r.error);
  return outcome;
}
