import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe part of the Auth.js config (used by middleware). Providers that
 * need Node APIs (argon2, DB) are added in ./index.ts.
 */
export const authConfig = {
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = (user as { role?: string }).role as typeof token.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid && token.role) {
        session.user.id = token.uid;
        session.user.role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
