import { redirect } from "next/navigation";
import { currentActor } from "@/server/http/guard";

export const dynamic = "force-dynamic";

/** Post-login router: sends each role to its cabinet. */
export default async function Dashboard() {
  const a = await currentActor();
  if (!a) redirect("/login");
  redirect(a.role === "candidate" ? "/candidate" : a.role === "employer" ? "/employer" : "/admin");
}
