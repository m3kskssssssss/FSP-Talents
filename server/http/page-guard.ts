import { redirect } from "next/navigation";
import type { Role } from "../services/accounts";
import { AppError } from "../lib/errors";
import * as guard from "./guard";

/**
 * Guards for server-rendered pages. API routes answer 401/403 as JSON, but a
 * page that throws shows "Application error" instead. That happens with a
 * stale session cookie: the stand reseeds its database on every deploy, so a
 * browser can hold a valid JWT for a user that no longer exists. Pages send
 * such visitors to the login form, and a wrong role to the home page.
 */
async function orRedirect<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof AppError && e.status === 401) redirect("/login");
    if (e instanceof AppError && e.status === 403) redirect("/");
    throw e;
  }
}

export const requireActor = (...roles: Role[]) => orRedirect(() => guard.requireActor(...roles));
export const requireCandidate = () => orRedirect(guard.requireCandidate);
export const requireEmployer = () => orRedirect(guard.requireEmployer);
