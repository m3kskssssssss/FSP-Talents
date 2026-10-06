import { requireEmployer } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { closeVacancy } from "@/server/services/vacancies";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireEmployer();
  return closeVacancy(me.employerId, params.id);
});
