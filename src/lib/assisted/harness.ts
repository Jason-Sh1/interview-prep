// Runs the tests of a small multi-file JavaScript repo (an AI-assisted round's
// codebase). Files are CommonJS modules; `require("./x")` resolves within the
// repo. Test files get `test`, `it`, `describe` and a small `expect`. The
// program is plain JavaScript so it can run in a browser Web Worker (see
// ./browser.ts) or, in unit tests, with `new Function`.

export interface TestResult {
  file: string;
  name: string;
  passed: boolean;
  error?: string;
}

export interface HarnessResult {
  results: TestResult[];
  passed: number;
  total: number;
  /** Set when the harness itself failed (e.g. it timed out). */
  error?: string;
}

/** The runtime, as a string, so it can be shipped into a worker. */
const RUNTIME = String.raw`
var __tests = [];
var __prefix = [];
var __cache = {};

function __deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  var ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (var i = 0; i < ka.length; i++) if (!Object.prototype.hasOwnProperty.call(b, ka[i]) || !__deepEqual(a[ka[i]], b[ka[i]])) return false;
  return true;
}
function __show(v) {
  try { return v === undefined ? "undefined" : typeof v === "function" ? "[Function]" : JSON.stringify(v); } catch (e) { return String(v); }
}
function expect(actual) {
  function make(negate) {
    function check(ok, msg) { if (negate ? ok : !ok) throw new Error((negate ? "Expected not: " : "") + msg); }
    var m = {
      toBe: function (exp) { check(Object.is(actual, exp), "expected " + __show(actual) + " to be " + __show(exp)); },
      toEqual: function (exp) { check(__deepEqual(actual, exp), "expected " + __show(actual) + " to equal " + __show(exp)); },
      toBeTruthy: function () { check(!!actual, "expected " + __show(actual) + " to be truthy"); },
      toBeFalsy: function () { check(!actual, "expected " + __show(actual) + " to be falsy"); },
      toBeNull: function () { check(actual === null, "expected " + __show(actual) + " to be null"); },
      toBeUndefined: function () { check(actual === undefined, "expected " + __show(actual) + " to be undefined"); },
      toBeGreaterThan: function (n) { check(actual > n, "expected " + __show(actual) + " to be greater than " + n); },
      toBeLessThan: function (n) { check(actual < n, "expected " + __show(actual) + " to be less than " + n); },
      toContain: function (x) { check(actual != null && actual.indexOf(x) !== -1, "expected " + __show(actual) + " to contain " + __show(x)); },
      toHaveLength: function (n) { check(actual != null && actual.length === n, "expected length " + n + ", got " + (actual == null ? actual : actual.length)); },
      toThrow: function () {
        var threw = false;
        try { actual(); } catch (e) { threw = true; }
        check(threw, "expected the function to throw");
      },
    };
    return m;
  }
  var api = make(false);
  api.not = make(true);
  return api;
}
function test(name, fn) { __tests.push({ file: __currentFile, name: __prefix.concat([name]).join(" > "), fn: fn }); }
var it = test;
function describe(name, fn) { __prefix.push(name); try { fn(); } finally { __prefix.pop(); } }
var __currentFile = "";

function __resolve(from, req) {
  if (req.charAt(0) !== ".") throw new Error("Cannot find module '" + req + "': only files in this repo can be required");
  var parts = from.split("/").slice(0, -1);
  var segs = req.split("/");
  for (var i = 0; i < segs.length; i++) {
    if (segs[i] === "." || segs[i] === "") continue;
    if (segs[i] === "..") parts.pop(); else parts.push(segs[i]);
  }
  var p = parts.join("/");
  if (__files[p] === undefined && __files[p + ".js"] !== undefined) p = p + ".js";
  else if (__files[p] === undefined && __files[p + "/index.js"] !== undefined) p = p + "/index.js";
  if (__files[p] === undefined) throw new Error("Cannot find module '" + req + "' from " + from);
  return p;
}
function __load(path) {
  if (__cache[path]) return __cache[path].exports;
  var module = { exports: {} };
  __cache[path] = module;
  var fn = new Function("require", "module", "exports", "test", "it", "describe", "expect", __files[path] + "\n//# sourceURL=" + path);
  fn(function (r) { return __load(__resolve(path, r)); }, module, module.exports, test, it, describe, expect);
  return module.exports;
}
function __msg(e) { return e && e.message ? (e.name && e.name !== "Error" ? e.name + ": " : "") + e.message : String(e); }

return (async function () {
  var results = [];
  for (var i = 0; i < __testFiles.length; i++) {
    __currentFile = __testFiles[i];
    try { __load(__testFiles[i]); }
    catch (e) { results.push({ file: __testFiles[i], name: "loading " + __testFiles[i], passed: false, error: __msg(e) }); }
  }
  for (var j = 0; j < __tests.length; j++) {
    var t = __tests[j];
    try {
      await Promise.race([
        Promise.resolve().then(t.fn),
        new Promise(function (_, rej) { setTimeout(function () { rej(new Error("Timed out after 2s")); }, 2000); }),
      ]);
      results.push({ file: t.file, name: t.name, passed: true });
    } catch (e) {
      results.push({ file: t.file, name: t.name, passed: false, error: __msg(e) });
    }
  }
  var passed = results.filter(function (r) { return r.passed; }).length;
  return { results: results, passed: passed, total: results.length };
})();
`;

/** A program whose body returns a Promise of the HarnessResult when run with `new Function`. */
export function buildHarness(files: Record<string, string>, testFiles: string[]): string {
  return `var __files = ${JSON.stringify(files)};\nvar __testFiles = ${JSON.stringify(testFiles)};\n${RUNTIME}`;
}

/** Runs the harness in the current JavaScript context (unit tests and validation only). */
export async function runHarnessHere(files: Record<string, string>, testFiles: string[]): Promise<HarnessResult> {
  return (await new Function(buildHarness(files, testFiles))()) as HarnessResult;
}
