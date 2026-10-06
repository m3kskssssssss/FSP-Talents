import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Keycloak from "next-auth/providers/keycloak";
import { env } from "../env";
import { loginSchema } from "../schemas/auth";
import { authenticate, upsertOidcUser } from "../services/accounts";
import { rateLimit } from "../http/rate-limit";
import { authConfig } from "./config";

class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}
class EmailNotVerified extends CredentialsSignin {
  code = "email_not_verified";
}
class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

function providers(): NextAuthConfig["providers"] {
  const list: NextAuthConfig["providers"] = [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidCredentials();
        const rl = await rateLimit(`login:${parsed.data.email}`, 10, 15 * 60);
        if (!rl.ok) throw new RateLimited();
        const res = await authenticate(parsed.data.email, parsed.data.password);
        if (!res.ok) throw res.reason === "email_not_verified" ? new EmailNotVerified() : new InvalidCredentials();
        return { id: res.user.id, email: res.user.email, role: res.user.role };
      },
    }),
  ];
  const e = env();
  if (e.AUTH_KEYCLOAK_ENABLED && e.AUTH_KEYCLOAK_ID && e.AUTH_KEYCLOAK_ISSUER) {
    // "FSP ID": an OIDC provider backed by Keycloak. Disabled by default.
    list.push(
      Keycloak({
        clientId: e.AUTH_KEYCLOAK_ID,
        clientSecret: e.AUTH_KEYCLOAK_SECRET ?? "",
        issuer: e.AUTH_KEYCLOAK_ISSUER,
      }),
    );
  }
  return list;
}

export const keycloakEnabled = () => {
  const e = env();
  return Boolean(e.AUTH_KEYCLOAK_ENABLED && e.AUTH_KEYCLOAK_ID && e.AUTH_KEYCLOAK_ISSUER);
};

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  ...authConfig,
  providers: providers(),
  logger: {
    // Wrong passwords are expected; do not spam logs (and never log emails).
    error(e) {
      if (e.name === "CredentialsSignin" || (e as { type?: string }).type === "CredentialsSignin") return;
      console.error("[auth]", e.name, e.message);
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "keycloak" && profile?.email) {
        const u = await upsertOidcUser(profile.email, (profile.name as string | undefined) ?? undefined);
        token.uid = u.id;
        token.role = u.role;
        return token;
      }
      return authConfig.callbacks.jwt({ token, user });
    },
  },
}));
