/* Sandbox for candidate code. Runs in a dedicated Web Worker: no DOM, no
 * access to the page, terminated by the main thread on timeout.
 * Python: Pyodide; JavaScript: native; SQL: sql.js (SQLite/WASM). */
/* Module worker: Pyodide >= 0.28 does not support classic workers. */

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";
const SQLJS_URL = "https://cdn.jsdelivr.net/npm/sql.js@1.14.2/dist/";

let pyodidePromise = null;
let sqlPromise = null;
let interruptBuffer = null;

function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = import(PYODIDE_URL + "pyodide.mjs")
      .then((m) => m.loadPyodide({ indexURL: PYODIDE_URL }))
      .then((py) => {
        if (interruptBuffer) py.setInterruptBuffer(interruptBuffer);
        return py;
      });
    pyodidePromise.catch(() => (pyodidePromise = null));
  }
  return pyodidePromise;
}

function getSql() {
  if (!sqlPromise) {
    // sql.js ships a UMD build; module workers have no importScripts, so
    // evaluate it in the global scope to get `initSqlJs`.
    sqlPromise = fetch(SQLJS_URL + "sql-wasm.js")
      .then((r) => r.text())
      .then((src) => {
        (0, eval)(src);
        return globalThis.initSqlJs({ locateFile: (f) => SQLJS_URL + f });
      });
    sqlPromise.catch(() => (sqlPromise = null));
  }
  return sqlPromise;
}

const clone = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));

function runJs(code, fnName, inputs) {
  const logs = [];
  const fakeConsole = { log: (...a) => logs.push(a.map(String).join(" ")) };
  let fn;
  try {
    fn = new Function("console", `"use strict";\n${code}\n;return typeof ${fnName} === "function" ? ${fnName} : undefined;`)(fakeConsole);
  } catch (e) {
    return { compileError: String(e && e.message ? e.message : e), outputs: [], logs };
  }
  if (typeof fn !== "function") return { compileError: `Функция ${fnName} не найдена`, outputs: [], logs };
  const outputs = inputs.map((args) => {
    try {
      return { ok: true, value: clone(fn(...clone(args))) };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });
  return { outputs, logs };
}

const PY_HARNESS = `
import json, sys, io, traceback
def __run_all(fn_name, inputs_json):
    ns = __candidate_ns
    fn = ns.get(fn_name)
    if not callable(fn):
        return json.dumps({"compileError": "Функция %s не найдена" % fn_name, "outputs": []})
    out = []
    for args in json.loads(inputs_json):
        try:
            out.append({"ok": True, "value": fn(*args)})
        except KeyboardInterrupt:
            raise
        except Exception as e:
            out.append({"ok": False, "error": "%s: %s" % (type(e).__name__, e)})
    return json.dumps({"outputs": out}, default=lambda o: list(o) if isinstance(o, (set, tuple)) else str(o))
`;

async function runPython(code, fnName, inputs) {
  const py = await getPyodide();
  if (interruptBuffer) interruptBuffer[0] = 0;
  const stdout = [];
  py.setStdout({ batched: (s) => stdout.push(s) });
  const ns = py.globals.get("dict")();
  py.globals.set("__candidate_ns", ns);
  try {
    py.runPython(code, { globals: ns });
  } catch (e) {
    return { compileError: String(e.message || e).split("\n").slice(-3).join("\n"), outputs: [], logs: stdout };
  }
  py.runPython(PY_HARNESS);
  const runAll = py.globals.get("__run_all");
  const res = JSON.parse(runAll(fnName, JSON.stringify(inputs)));
  res.logs = stdout;
  return res;
}

async function runSql(schema, data, query) {
  const SQL = await getSql();
  const db = new SQL.Database();
  try {
    db.exec(schema);
    db.exec(data);
    const res = db.exec(query);
    const last = res[res.length - 1];
    return { result: last ? { columns: last.columns, rows: last.values } : { columns: [], rows: [] } };
  } catch (e) {
    return { result: { error: String(e.message || e) } };
  } finally {
    db.close();
  }
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (msg.type === "init") {
    if (msg.interruptBuffer) interruptBuffer = msg.interruptBuffer;
    return;
  }
  if (msg.type === "warmup") {
    try {
      if (msg.lang === "python") await getPyodide();
      if (msg.lang === "sql") await getSql();
      self.postMessage({ id: msg.id, type: "ready" });
    } catch (e) {
      self.postMessage({ id: msg.id, type: "error", error: String(e.message || e) });
    }
    return;
  }
  try {
    let out;
    if (msg.lang === "javascript") out = runJs(msg.code, msg.fnName, msg.inputs);
    else if (msg.lang === "python") out = await runPython(msg.code, msg.fnName, msg.inputs);
    else out = await runSql(msg.schema, msg.data, msg.code);
    self.postMessage({ id: msg.id, type: "result", ...out });
  } catch (e) {
    const text = String(e && e.message ? e.message : e);
    self.postMessage({ id: msg.id, type: "error", error: /KeyboardInterrupt/.test(text) ? "timeout" : text });
  }
};
