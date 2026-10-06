import { PageTitle } from "@/components/ui/blank";
import { requireActor } from "@/server/http/guard";

export const dynamic = "force-dynamic";

export default async function EmployerHome() {
  const a = await requireActor("employer");
  return <PageTitle kicker="Кабинет работодателя" title="Добро пожаловать">{a.email}</PageTitle>;
}
