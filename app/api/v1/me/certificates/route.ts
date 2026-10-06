import { requireCandidate } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { AppError } from "@/server/lib/errors";
import { certificateInfoSchema } from "@/server/schemas/candidate";
import { uploadCertificate } from "@/server/services/candidate";

/** Certificate (PDF/JPG/PNG, multipart "file" + achievement fields): metadata risk signals -> trust level. */
export const POST = route(async (req) => {
  const me = await requireCandidate();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !file || typeof file === "string") throw new AppError(422, "validation_error", "Прикрепите файл сертификата");
  const info = certificateInfoSchema.parse(Object.fromEntries([...form.entries()].filter(([k, v]) => k !== "file" && v !== "")));
  return uploadCertificate(me.profileId, { name: file.name, data: Buffer.from(await file.arrayBuffer()) }, info);
});
