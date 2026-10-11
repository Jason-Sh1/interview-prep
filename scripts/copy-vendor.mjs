// Copies the Monaco editor and Pyodide (Python in WebAssembly) into
// public/vendor so the app serves them itself instead of relying on a CDN.
// Runs on postinstall.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "vendor");

function pkgDir(name) {
  return join(root, "node_modules", name);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

cpSync(join(pkgDir("monaco-editor"), "min", "vs"), join(out, "monaco", "vs"), { recursive: true });

const pyodide = pkgDir("pyodide");
mkdirSync(join(out, "pyodide"), { recursive: true });
for (const f of ["pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
  if (!existsSync(join(pyodide, f))) throw new Error(`pyodide/${f} is missing`);
  cpSync(join(pyodide, f), join(out, "pyodide", f));
}
console.log("Copied Monaco and Pyodide to public/vendor");
