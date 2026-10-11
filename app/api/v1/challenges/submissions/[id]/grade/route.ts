import { requireEmployer } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { challengeGradeSchema } from "@/server/schemas/challenges";
import { gradeSubmission } from "@/server/services/challenges";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const me = await requireEmployer();
  return gradeSubmission(me.employerId, params.id, await parseJson(req, challengeGradeSchema));
});
