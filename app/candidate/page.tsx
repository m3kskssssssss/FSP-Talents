import { PageTitle } from "@/components/ui/blank";
import { requireActor } from "@/server/http/guard";

export const dynamic = "force-dynamic";

export default async function CandidateHome() {
  const a = await requireActor("candidate");
  return <PageTitle kicker="Кабинет кандидата" title="Добро пожаловать">{a.email}</PageTitle>;
}
