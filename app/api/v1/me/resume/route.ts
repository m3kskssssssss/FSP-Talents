import { requireCandidate } from "@/server/http/guard";
import { limitOrThrow, route } from "@/server/http/route";
import { AppError } from "@/server/lib/errors";
import { uploadResume } from "@/server/services/candidate";

export const maxDuration = 30;

/** PDF upload (multipart, field "file", <= 4 MB): text extraction + LLM/rules parsing. */
export const POST = route(async (req) => {
  const me = await requireCandidate();
  await limitOrThrow(`llm:${me.userId}`, 20, 3600);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") throw new AppError(422, "validation_error", "Прикрепите PDF-файл");
  return uploadResume(me.profileId, { name: file.name, type: file.type, data: Buffer.from(await file.arrayBuffer()) });
});
