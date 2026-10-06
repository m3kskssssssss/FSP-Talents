import { PageTitle } from "@/components/ui/blank";
import { requireActor } from "@/server/http/guard";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const a = await requireActor("admin");
  return <PageTitle kicker="Модерация" title="Добро пожаловать">{a.email}</PageTitle>;
}
