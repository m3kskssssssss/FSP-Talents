/** Small typed fetch helper for client components. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init?.signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { code: string; message: string; details?: { path: string; message: string }[] } }).error;
    throw new ApiError(res.status, err?.code ?? "error", err?.message ?? `Ошибка ${res.status}`, err?.details);
  }
  return data as T;
}

export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !Array.isArray(e.details)) return {};
  const out: Record<string, string> = {};
  for (const d of e.details) if (d.path && !out[d.path]) out[d.path] = d.message;
  return out;
}
