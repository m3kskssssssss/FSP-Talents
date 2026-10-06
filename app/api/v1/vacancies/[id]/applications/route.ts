import { requireEmployer } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { vacancyApplications } from "@/server/services/vacancies";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireEmployer();
  return vacancyApplications(me.employerId, params.id);
});
