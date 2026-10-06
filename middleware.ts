import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./server/auth/config";

const { auth } = NextAuth(authConfig);

const areas: { prefix: string; roles: string[] }[] = [
  { prefix: "/candidate", roles: ["candidate"] },
  { prefix: "/test", roles: ["candidate"] },
  { prefix: "/employer", roles: ["employer"] },
  { prefix: "/admin", roles: ["admin"] },
];

/** First line of role-based access control; services re-check on every call. */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const area = areas.find((a) => pathname === a.prefix || pathname.startsWith(a.prefix + "/"));
  if (!area) return NextResponse.next();
  const role = req.auth?.user?.role;
  if (!role) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (!area.roles.includes(role)) return NextResponse.redirect(new URL("/", req.nextUrl));
  return NextResponse.next();
});

export const config = { matcher: ["/candidate/:path*", "/test/:path*", "/employer/:path*", "/admin/:path*"] };
