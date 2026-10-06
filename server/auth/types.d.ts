import "next-auth";
import "next-auth/jwt";

type AppRole = "candidate" | "employer" | "admin";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: AppRole; email?: string | null; name?: string | null };
  }
  interface User {
    role?: AppRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: AppRole;
  }
}
