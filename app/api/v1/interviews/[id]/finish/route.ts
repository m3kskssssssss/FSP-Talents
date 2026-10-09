import { requireEmployer } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { uuidSchema } from "@/server/schemas/common";
import { interviewFinishSchema } from "@/server/schemas/interviews";
import { finishInterview } from "@/server/services/interviews";

/** The employer's private verdict; the candidate never sees it. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const me = await requireEmployer();
  const input = await parseJson(req, interviewFinishSchema);
  await finishInterview(me.employerId, uuidSchema.parse(params.id), input);
});
