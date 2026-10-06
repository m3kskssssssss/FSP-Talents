import path from "node:path";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

let sqlPromise: Promise<SqlJsStatic> | null = null;

/** sql.js (SQLite compiled to WASM) on the server: same engine as in the browser. */
export function getSqlJs() {
  if (!sqlPromise) {
    // sql.js is a server external package; its wasm file is located from the
    // project root (and traced into serverless bundles via outputFileTracingIncludes).
    const wasmDir = path.join(process.cwd(), "node_modules", "sql.js", "dist");
    sqlPromise = initSqlJs({ locateFile: (f: string) => path.join(wasmDir, f) });
  }
  return sqlPromise;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
}

export async function runSql(schema: string, data: string, query: string): Promise<QueryResult> {
  const SQL = await getSqlJs();
  const db: Database = new SQL.Database();
  try {
    db.exec(schema);
    db.exec(data);
    const res = db.exec(query);
    const last = res[res.length - 1];
    return last ? { columns: last.columns, rows: last.values as unknown[][] } : { columns: [], rows: [] };
  } finally {
    db.close();
  }
}
