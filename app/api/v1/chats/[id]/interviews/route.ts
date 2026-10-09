import { requireEmployer } from "@/server/http/guard";
import { limitOrThrow, parseJson, route } from "@/server/http/route";
import { uuidSchema } from "@/server/schemas/common";
import { interviewCreateSchema } from "@/server/schemas/interviews";
import { scheduleInterview } from "@/server/services/interviews";

/** The employer schedules a video interview with the candidate of this chat. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const me = await requireEmployer();
  await limitOrThrow(`interview-new:${me.userId}`, 20, 3600);
  const input = await parseJson(req, interviewCreateSchema);
  return scheduleInterview(me.employerId, uuidSchema.parse(params.id), input);
});
