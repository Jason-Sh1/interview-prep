"use client";
// Runs a round's tests in a Web Worker, so candidate code never touches the
// server and a stuck program is stopped by terminating the worker.
import { buildHarness, type HarnessResult } from "./harness";

const TIME_LIMIT_MS = 15_000;

const WORKER = `
self.onmessage = async function (e) {
  try {
    var res = await (new Function(e.data.program))();
    self.postMessage(res);
  } catch (err) {
    self.postMessage({ results: [], passed: 0, total: 0, error: String(err && err.message ? err.message : err) });
  }
};`;

export function runRepoTests(files: Record<string, string>, testFiles: string[]): Promise<HarnessResult> {
  return new Promise((resolve) => {
    const worker = new Worker(URL.createObjectURL(new Blob([WORKER], { type: "text/javascript" })));
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ results: [], passed: 0, total: 0, error: "The tests took longer than 15 seconds (an infinite loop?)" });
    }, TIME_LIMIT_MS);
    worker.onmessage = (e: MessageEvent<HarnessResult>) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ results: [], passed: 0, total: 0, error: e.message || "Could not start the test runner" });
    };
    worker.postMessage({ program: buildHarness(files, testFiles) });
  });
}
