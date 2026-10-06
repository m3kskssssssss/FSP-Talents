import { env } from "../env";

/**
 * Repository evidence for a hackathon result (trust level "repo"): the
 * candidate is among the commit authors, there are commits inside the event
 * window, and the repository is not a fork. Uses the public GitHub REST API
 * (GITHUB_TOKEN raises the rate limit; OAuth linking proves account ownership
 * and is planned — without it the login is self-declared).
 */
export interface RepoCheckInput {
  repo: string; // owner/name
  login: string;
  from: string; // ISO date
  to: string; // ISO date
}

export interface RepoCheckResult {
  ok: boolean;
  checks: { code: string; title: string; passed: boolean }[];
  commits: number;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export async function checkRepository(input: RepoCheckInput, fetchImpl: Fetch = fetch): Promise<RepoCheckResult> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "fsp-talents" };
  if (env().GITHUB_TOKEN) headers.Authorization = `Bearer ${env().GITHUB_TOKEN}`;
  const api = (path: string) => fetchImpl(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(8000) });
  const checks: RepoCheckResult["checks"] = [];
  const r = await api(`/repos/${input.repo}`);
  if (r.status === 404) return { ok: false, checks: [{ code: "exists", title: "Репозиторий не найден или приватный", passed: false }], commits: 0 };
  if (!r.ok) throw new Error(`github ${r.status}`);
  const repo = (await r.json()) as { fork: boolean; created_at: string };
  checks.push({ code: "not_fork", title: "Репозиторий не является форком", passed: !repo.fork });
  const c = await api(`/repos/${input.repo}/commits?author=${encodeURIComponent(input.login)}&since=${input.from}&until=${input.to}&per_page=100`);
  const commits = c.ok ? ((await c.json()) as unknown[]).length : 0;
  checks.push({ code: "author", title: `Коммиты автора ${input.login} в окне мероприятия: ${commits}`, passed: commits > 0 });
  const created = Date.parse(repo.created_at);
  checks.push({ code: "created_in_window", title: "Репозиторий создан не раньше чем за неделю до мероприятия", passed: created >= Date.parse(input.from) - 7 * 86400_000 });
  return { ok: checks.every((x) => x.passed), checks, commits };
}
