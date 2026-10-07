import { requireEmployer } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { notFound } from "@/server/lib/errors";
import { uuidSchema } from "@/server/schemas/common";
import { readPhoto } from "@/server/services/candidate";
import { hasContactAccess } from "@/server/services/invitations";

/**
 * Candidate photo for an employer. A photo identifies the person as much as a
 * name, so it opens together with the contacts: only after the candidate
 * accepted this employer's invitation. Otherwise 404, as if there were none.
 */
export const GET = route<{ profileId: string }>(async (_req, { params }) => {
  const me = await requireEmployer();
  const profileId = uuidSchema.parse(params.profileId);
  if (!(await hasContactAccess(me.employerId, profileId))) throw notFound("Фото недоступно");
  const photo = await readPhoto(profileId);
  if (!photo) throw notFound("Фото не загружено");
  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.type, "Cache-Control": "private, max-age=86400" },
  });
});
