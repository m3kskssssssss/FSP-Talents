import { AppError } from "../lib/errors";

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile|webOS|BlackBerry/i;

/**
 * Phone or tablet, judged by the request headers (Client Hints first, then the
 * user agent). iPadOS Safari poses as a Mac, so the client also checks the
 * pointer; this is the server-side backstop.
 */
export function isMobileRequest(h: Headers) {
  if (h.get("sec-ch-ua-mobile") === "?1") return true;
  return MOBILE_UA.test(h.get("user-agent") ?? "");
}

/** Tests and video interviews need a computer: a full keyboard, a big screen, a webcam setup. */
export function requireDesktop(h: Headers, what: string) {
  if (isMobileRequest(h))
    throw new AppError(403, "desktop_only", `${what} доступно только с компьютера`);
}
