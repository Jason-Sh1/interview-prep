// Builds a self-contained program from the user's code and a list of tests.
// The program runs every test, catches errors per test, and prints one line
// `__RESULTS__<json>` with the actual values. Comparing with the expected
// values happens in TypeScript (see compare.ts), so it is shared by every runner.
//
// The same program runs in Judge0, in a browser worker and in Node/Python
// locally, so the generated code avoids newer syntax (Judge0's default
// JavaScript is Node 12 and its default Python is 3.8).

import type { Param, Signature, TestCase, ValueType } from "../problems/types";

export type Language = "javascript" | "python";

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: "python", label: "Python 3" },
  { id: "javascript", label: "JavaScript" },
];

export const RESULTS_MARKER = "__RESULTS__";

export interface RawTestResult {
  /** Serialized return value (lists and trees as arrays). */
  actual?: unknown;
  error?: string;
  stdout: string;
  ms: number;
}

export function toSnakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function pyType(t: ValueType): string {
  switch (t) {
    case "int":
      return "int";
    case "float":
      return "float";
    case "bool":
      return "bool";
    case "string":
      return "str";
    case "int[]":
      return "List[int]";
    case "float[]":
      return "List[float]";
    case "bool[]":
      return "List[bool]";
    case "string[]":
      return "List[str]";
    case "int[][]":
      return "List[List[int]]";
    case "string[][]":
      return "List[List[str]]";
    case "ListNode":
      return "Optional[ListNode]";
    case "TreeNode":
      return "Optional[TreeNode]";
    case "void":
      return "None";
  }
}

function jsType(t: ValueType): string {
  switch (t) {
    case "int":
    case "float":
      return "number";
    case "bool":
      return "boolean";
    case "string":
      return "string";
    case "int[]":
    case "float[]":
      return "number[]";
    case "bool[]":
      return "boolean[]";
    case "string[]":
      return "string[]";
    case "int[][]":
      return "number[][]";
    case "string[][]":
      return "string[][]";
    case "ListNode":
      return "ListNode | null";
    case "TreeNode":
      return "TreeNode | null";
    case "void":
      return "void";
  }
}

const usesType = (sig: Signature, t: ValueType) => {
  const all: Param[] =
    sig.kind === "function"
      ? [...sig.params, { name: "", type: sig.returns }]
      : [
          ...sig.constructorParams,
          ...sig.methods.flatMap((m) => [...m.params, { name: "", type: m.returns }]),
        ];
  return all.some((p) => p.type === t);
};

function jsDoc(params: Param[], returns: ValueType, indent = ""): string {
  const lines = params.map((p) => `${indent} * @param {${jsType(p.type)}} ${p.name}`);
  if (returns !== "void") lines.push(`${indent} * @return {${jsType(returns)}}`);
  return `${indent}/**\n${lines.join("\n")}\n${indent} */`;
}

/** Starter code shown in the editor. */
export function starterCode(sig: Signature, lang: Language): string {
  const header: string[] = [];
  if (lang === "javascript") {
    if (usesType(sig, "ListNode"))
      header.push(
        "// Provided: class ListNode { constructor(val = 0, next = null) { this.val = val; this.next = next; } }",
      );
    if (usesType(sig, "TreeNode"))
      header.push(
        "// Provided: class TreeNode { constructor(val = 0, left = null, right = null) { ... } }",
      );
    const pre = header.length ? header.join("\n") + "\n\n" : "";
    if (sig.kind === "function") {
      const args = sig.params.map((p) => p.name).join(", ");
      return `${pre}${jsDoc(sig.params, sig.returns)}\nfunction ${sig.name}(${args}) {\n  \n}\n`;
    }
    const ctorArgs = sig.constructorParams.map((p) => p.name).join(", ");
    const methods = sig.methods
      .map(
        (m) =>
          `${jsDoc(m.params, m.returns, "  ")}\n  ${m.name}(${m.params.map((p) => p.name).join(", ")}) {\n    \n  }`,
      )
      .join("\n\n");
    return `${pre}class ${sig.className} {\n  constructor(${ctorArgs}) {\n    \n  }\n\n${methods}\n}\n`;
  }

  if (usesType(sig, "ListNode"))
    header.push(
      "# Provided:\n# class ListNode:\n#     def __init__(self, val=0, next=None):\n#         self.val = val\n#         self.next = next",
    );
  if (usesType(sig, "TreeNode"))
    header.push(
      "# Provided:\n# class TreeNode:\n#     def __init__(self, val=0, left=None, right=None):\n#         self.val = val\n#         self.left = left\n#         self.right = right",
    );
  const pre = header.length ? header.join("\n") + "\n\n" : "";
  const pyParams = (ps: Param[]) =>
    ps.map((p) => `${toSnakeCase(p.name)}: ${pyType(p.type)}`).join(", ");
  if (sig.kind === "function") {
    return `${pre}def ${toSnakeCase(sig.name)}(${pyParams(sig.params)}) -> ${pyType(sig.returns)}:\n    pass\n`;
  }
  const ctor = sig.constructorParams.length ? ", " + pyParams(sig.constructorParams) : "";
  const methods = sig.methods
    .map(
      (m) =>
        `    def ${toSnakeCase(m.name)}(self${m.params.length ? ", " + pyParams(m.params) : ""}) -> ${pyType(m.returns)}:\n        pass`,
    )
    .join("\n\n");
  return `${pre}class ${sig.className}:\n    def __init__(self${ctor}):\n        pass\n\n${methods}\n`;
}

// ---------------------------------------------------------------------------
// JavaScript

const JS_PRELUDE = `
class ListNode { constructor(val, next) { this.val = val === undefined ? 0 : val; this.next = next === undefined ? null : next; } }
class TreeNode { constructor(val, left, right) { this.val = val === undefined ? 0 : val; this.left = left === undefined ? null : left; this.right = right === undefined ? null : right; } }
`;

const JS_HARNESS = `
function __toList(a) { var d = new ListNode(0), c = d; for (var i = 0; i < a.length; i++) { c.next = new ListNode(a[i]); c = c.next; } return d.next; }
function __fromList(n) { var out = [], seen = 0; while (n) { out.push(n.val); n = n.next; if (++seen > 100000) throw new Error("Linked list has a cycle or is too long"); } return out; }
function __toTree(a) {
  if (!a.length || a[0] === null) return null;
  var root = new TreeNode(a[0]), q = [root], i = 1;
  for (var h = 0; h < q.length && i < a.length; h++) {
    var node = q[h];
    if (i < a.length && a[i] !== null) { node.left = new TreeNode(a[i]); q.push(node.left); } i++;
    if (i < a.length && a[i] !== null) { node.right = new TreeNode(a[i]); q.push(node.right); } i++;
  }
  return root;
}
function __fromTree(root) {
  var out = [], q = [root];
  for (var h = 0; h < q.length; h++) { var n = q[h]; if (n) { out.push(n.val); q.push(n.left, n.right); } else out.push(null); }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}
function __in(type, v) { return type === "ListNode" ? __toList(v) : type === "TreeNode" ? __toTree(v) : (v !== null && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v); }
function __out(type, v) {
  if (v === undefined) v = null;
  if (type === "ListNode") return __fromList(v);
  if (type === "TreeNode") return __fromTree(v);
  if (type === "void") return null;
  return v;
}
function __err(e) { return e && e.stack ? String(e.stack).split("\\n").slice(0, 4).join("\\n") : String(e); }
function __run(sig, tests, impl) {
  var results = [];
  var origLog = console.log;
  for (var t = 0; t < tests.length; t++) {
    var buf = [];
    console.log = function () { buf.push(Array.prototype.slice.call(arguments).map(function (x) { return typeof x === "string" ? x : JSON.stringify(x); }).join(" ")); };
    var start = Date.now();
    var r = { stdout: "", ms: 0 };
    try { r.actual = impl(sig, tests[t].input); } catch (e) { r.error = __err(e); }
    r.ms = Date.now() - start;
    console.log = origLog;
    r.stdout = buf.join("\\n").slice(0, 2000);
    results.push(r);
  }
  return results;
}
function __callFunction(sig, input) {
  var args = sig.params.map(function (p, i) { return __in(p.type, input[i]); });
  var ret = __USER_FN__.apply(null, args);
  if (sig.inPlaceArg !== undefined && sig.inPlaceArg !== null) return __out(sig.params[sig.inPlaceArg].type, args[sig.inPlaceArg]);
  return __out(sig.returns, ret);
}
function __callDesign(sig, input) {
  var ops = input[0], argLists = input[1], out = [], obj = null;
  for (var i = 0; i < ops.length; i++) {
    if (i === 0) {
      var cargs = sig.constructorParams.map(function (p, j) { return __in(p.type, argLists[0][j]); });
      obj = new (Function.prototype.bind.apply(__USER_CLASS__, [null].concat(cargs)))();
      out.push(null);
      continue;
    }
    var m = null;
    for (var k = 0; k < sig.methods.length; k++) if (sig.methods[k].name === ops[i]) m = sig.methods[k];
    if (!m) throw new Error("Unknown operation " + ops[i]);
    if (typeof obj[m.name] !== "function") throw new Error("Method " + m.name + " is not defined");
    var margs = m.params.map(function (p, j) { return __in(p.type, argLists[i][j]); });
    out.push(__out(m.returns, obj[m.name].apply(obj, margs)));
  }
  return out;
}
`;

function buildJs(sig: Signature, userCode: string, tests: TestCase[]): string {
  const target = sig.kind === "function" ? sig.name : sig.className;
  const binding =
    sig.kind === "function"
      ? `var __USER_FN__ = (typeof ${target} === "function") ? ${target} : null;\nif (!__USER_FN__) throw new Error("Define a function named ${target}");`
      : `var __USER_CLASS__ = (typeof ${target} === "function") ? ${target} : null;\nif (!__USER_CLASS__) throw new Error("Define a class named ${target}");`;
  const call = sig.kind === "function" ? "__callFunction" : "__callDesign";
  return [
    `"use strict";`,
    JS_PRELUDE,
    "// ---- user code ----",
    userCode,
    "// ---- harness ----",
    JS_HARNESS,
    binding,
    `(function () {`,
    `var __SIG__ = ${JSON.stringify(sig)};`,
    `var __TESTS__ = ${JSON.stringify(tests.map((t) => ({ input: t.input })))};`,
    `var __R__ = __run(__SIG__, __TESTS__, ${call});`,
    `console.log(${JSON.stringify(RESULTS_MARKER)} + JSON.stringify(__R__));`,
    `})();`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Python

const PY_PRELUDE = `
from typing import *
import collections, heapq, math, functools, itertools, bisect, string, re
from collections import defaultdict, deque, Counter, OrderedDict
from heapq import heappush, heappop, heapify
from functools import lru_cache

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
`;

const PY_HARNESS = `
import json as __json, sys as __sys, io as __io, time as __time, traceback as __tb, copy as __copy

def __to_list(a):
    d = ListNode(0); c = d
    for v in a:
        c.next = ListNode(v); c = c.next
    return d.next

def __from_list(n):
    out = []
    while n is not None:
        out.append(n.val); n = n.next
        if len(out) > 100000:
            raise Exception("Linked list has a cycle or is too long")
    return out

def __to_tree(a):
    if not a or a[0] is None:
        return None
    root = TreeNode(a[0]); q = [root]; i = 1; h = 0
    while h < len(q) and i < len(a):
        node = q[h]; h += 1
        if i < len(a) and a[i] is not None:
            node.left = TreeNode(a[i]); q.append(node.left)
        i += 1
        if i < len(a) and a[i] is not None:
            node.right = TreeNode(a[i]); q.append(node.right)
        i += 1
    return root

def __from_tree(root):
    out = []; q = [root]; h = 0
    while h < len(q):
        n = q[h]; h += 1
        if n is not None:
            out.append(n.val); q.append(n.left); q.append(n.right)
        else:
            out.append(None)
    while out and out[-1] is None:
        out.pop()
    return out

def __in(t, v):
    if t == "ListNode": return __to_list(v)
    if t == "TreeNode": return __to_tree(v)
    return __copy.deepcopy(v)

def __out(t, v):
    if t == "ListNode": return __from_list(v)
    if t == "TreeNode": return __from_tree(v)
    if t == "void": return None
    if isinstance(v, tuple): v = list(v)
    return v

def __snake(name):
    out = ""
    for i, ch in enumerate(name):
        if ch.isupper() and i > 0 and (name[i-1].islower() or name[i-1].isdigit()):
            out += "_"
        out += ch.lower()
    return out

def __call_function(sig, inp):
    fn = globals().get(__snake(sig["name"])) or globals().get(sig["name"])
    if fn is None:
        raise Exception("Define a function named " + __snake(sig["name"]))
    args = [__in(p["type"], inp[i]) for i, p in enumerate(sig["params"])]
    ret = fn(*args)
    if sig.get("inPlaceArg") is not None:
        k = sig["inPlaceArg"]
        return __out(sig["params"][k]["type"], args[k])
    return __out(sig["returns"], ret)

def __call_design(sig, inp):
    ops, arg_lists = inp[0], inp[1]
    cls = globals().get(sig["className"])
    if cls is None:
        raise Exception("Define a class named " + sig["className"])
    out = []; obj = None
    for i, op in enumerate(ops):
        if i == 0:
            obj = cls(*[__in(p["type"], arg_lists[0][j]) for j, p in enumerate(sig["constructorParams"])])
            out.append(None)
            continue
        m = next((m for m in sig["methods"] if m["name"] == op), None)
        if m is None:
            raise Exception("Unknown operation " + op)
        fn = getattr(obj, __snake(m["name"]), None) or getattr(obj, m["name"], None)
        if fn is None:
            raise Exception("Method " + __snake(m["name"]) + " is not defined")
        out.append(__out(m["returns"], fn(*[__in(p["type"], arg_lists[i][j]) for j, p in enumerate(m["params"])])))
    return out

def __run(sig, tests):
    call = __call_function if sig["kind"] == "function" else __call_design
    results = []
    real = __sys.stdout
    for t in tests:
        buf = __io.StringIO()
        __sys.stdout = buf
        r = {"stdout": "", "ms": 0}
        start = __time.time()
        try:
            r["actual"] = call(sig, t["input"])
        except BaseException as e:
            if isinstance(e, KeyboardInterrupt):
                raise
            lines = __tb.format_exception(type(e), e, e.__traceback__)
            r["error"] = "".join(lines[-3:]).strip()
        r["ms"] = int((__time.time() - start) * 1000)
        __sys.stdout = real
        r["stdout"] = buf.getvalue()[:2000]
        results.append(r)
    return results
`;

function buildPython(sig: Signature, userCode: string, tests: TestCase[]): string {
  // JSON literals are valid Python except for true/false/null; parse them at runtime instead.
  const sigJson = JSON.stringify(JSON.stringify(sig));
  const testsJson = JSON.stringify(JSON.stringify(tests.map((t) => ({ input: t.input }))));
  return [
    PY_PRELUDE,
    "# ---- user code ----",
    userCode,
    "# ---- harness ----",
    PY_HARNESS,
    `__SIG__ = __json.loads(${sigJson})`,
    `__TESTS__ = __json.loads(${testsJson})`,
    `__R__ = __run(__SIG__, __TESTS__)`,
    `print(${JSON.stringify(RESULTS_MARKER)} + __json.dumps(__R__))`,
  ].join("\n");
}

/** Number of program lines before the first line of user code. */
export function userCodeLineOffset(lang: Language): number {
  const before =
    lang === "javascript"
      ? [`"use strict";`, JS_PRELUDE, "// ---- user code ----"]
      : [PY_PRELUDE, "# ---- user code ----"];
  return before.join("\n").split("\n").length;
}

/**
 * Rewrites line numbers in error messages so they point at the user's code.
 * `extra` covers wrappers that add lines of their own (e.g. `new Function`).
 */
export function remapLineNumbers(text: string, lang: Language, extra = 0): string {
  const offset = userCodeLineOffset(lang) + extra;
  if (lang === "python") {
    return text
      .replace(/File "[^"]*", line (\d+)/g, (_m, n) => {
        const line = Number(n) - offset;
        return line > 0 ? `line ${line}` : `harness line ${n}`;
      })
      .replace(/^\s*harness line.*\n?/gm, "");
  }
  return text.replace(/(?:<anonymous>|main\.js|eval[^:]*):(\d+):(\d+)/g, (m, n, c) => {
    const line = Number(n) - offset;
    return line > 0 ? `line ${line}:${c}` : m;
  });
}

export function buildProgram(
  sig: Signature,
  lang: Language,
  userCode: string,
  tests: TestCase[],
): string {
  return lang === "javascript" ? buildJs(sig, userCode, tests) : buildPython(sig, userCode, tests);
}

/** Splits program stdout into the results line and anything printed outside tests. */
export function parseProgramOutput(stdout: string): {
  results: RawTestResult[] | null;
  extra: string;
} {
  const idx = stdout.lastIndexOf(RESULTS_MARKER);
  if (idx === -1) return { results: null, extra: stdout };
  const lineEnd = stdout.indexOf("\n", idx);
  const json = stdout.slice(idx + RESULTS_MARKER.length, lineEnd === -1 ? undefined : lineEnd);
  try {
    return { results: JSON.parse(json), extra: stdout.slice(0, idx) };
  } catch {
    return { results: null, extra: stdout };
  }
}
