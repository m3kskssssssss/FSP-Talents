import { requireCandidate } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { AppError, notFound } from "@/server/lib/errors";
import { readPhoto, removePhoto, setPhoto } from "@/server/services/candidate";

/** Own profile photo. Private: the URL is versioned, so it may be cached by the browser only. */
export const GET = route(async () => {
  const me = await requireCandidate();
  const photo = await readPhoto(me.profileId);
  if (!photo) throw notFound("Фото не загружено");
  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.type, "Cache-Control": "private, max-age=86400" },
  });
});

/** Upload (multipart, field "file"): JPG or PNG up to 4 MB, metadata is stripped. */
export const POST = route(async (req) => {
  const me = await requireCandidate();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string")
    throw new AppError(422, "validation_error", "Прикрепите фотографию");
  return setPhoto(me.profileId, Buffer.from(await file.arrayBuffer()));
});

export const DELETE = route(async () => {
  const me = await requireCandidate();
  return removePhoto(me.profileId);
});
