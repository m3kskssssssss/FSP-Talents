import { requireEmployer } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { applicationStatusSchema } from "@/server/schemas/vacancies";
import { setApplicationStatus } from "@/server/services/vacancies";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const me = await requireEmployer();
  const { status } = await parseJson(req, applicationStatusSchema);
  return setApplicationStatus(me.employerId, params.id, status);
});
