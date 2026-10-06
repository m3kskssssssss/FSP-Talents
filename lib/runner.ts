"use client";

export type RunLang = "python" | "javascript" | "sql";
export type Output = { ok: true; value: unknown } | { ok: false; error: string };
export interface RunResult {
  outputs?: Output[];
  result?: { columns: string[]; rows: unknown[][] } | { error: string };
  compileError?: string;
  logs?: string[];
  timedOut?: boolean;
}

/**
 * Main-thread side of the code sandbox. Timeouts: when the page is
 * cross-origin isolated, Python is interrupted via a SharedArrayBuffer
 * (no reload); otherwise, and for JS/SQL, the worker is terminated.
 */
export class Runner {
  private worker: Worker | null = null;
  private interrupt: Uint8Array | null = null;
  private seq = 0;

  private ensure() {
    if (this.worker) return this.worker;
    this.worker = new Worker("/runner/worker.js", { type: "module" });
    if (typeof SharedArrayBuffer !== "undefined" && (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated) {
      this.interrupt = new Uint8Array(new SharedArrayBuffer(1));
      this.worker.postMessage({ type: "init", interruptBuffer: this.interrupt });
    }
    return this.worker;
  }

  private reset() {
    this.worker?.terminate();
    this.worker = null;
    this.interrupt = null;
  }

  warmup(lang: RunLang) {
    if (lang === "javascript") return Promise.resolve();
    return this.call({ type: "warmup", lang }, 120_000).then(() => undefined);
  }

  run(req: { lang: RunLang; code: string; fnName?: string; inputs?: unknown[][]; schema?: string; data?: string }, timeoutMs: number) {
    return this.call({ type: "run", ...req }, timeoutMs) as Promise<RunResult>;
  }

  private call(msg: Record<string, unknown>, timeoutMs: number): Promise<RunResult> {
    const w = this.ensure();
    const id = ++this.seq;
    return new Promise((resolve) => {
      let done = false;
      const finish = (r: RunResult) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        w.removeEventListener("message", onMsg);
        resolve(r);
      };
      const onMsg = (ev: MessageEvent) => {
        if (ev.data?.id !== id) return;
        if (ev.data.type === "error") finish(ev.data.error === "timeout" ? { timedOut: true } : { compileError: ev.data.error });
        else finish(ev.data as RunResult);
      };
      const timer = setTimeout(() => {
        if (this.interrupt && msg.lang === "python") {
          this.interrupt[0] = 2; // SIGINT -> KeyboardInterrupt inside Pyodide
          setTimeout(() => {
            if (!done) {
              this.reset();
              finish({ timedOut: true });
            }
          }, 1000);
        } else {
          this.reset();
          finish({ timedOut: true });
        }
      }, timeoutMs);
      w.addEventListener("message", onMsg);
      w.postMessage({ ...msg, id });
    });
  }

  dispose() {
    this.reset();
  }
}
