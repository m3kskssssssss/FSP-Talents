import { z } from "zod";
import { candidateProfileId, employerId, requireActor } from "@/server/http/guard";
import { limitOrThrow, parseJson, parseQuery, route } from "@/server/http/route";
import { invitationCreateSchema } from "@/server/schemas/invitations";
import { createInvitation, listForCandidate, listForEmployer } from "@/server/services/invitations";

const statusQuery = z.object({ status: z.enum(["sent", "viewed", "accepted", "declined", "withdrawn", "expired"]).optional() });

/** Candidates get their own invitations, employers get the ones they sent. */
export const GET = route(async (req) => {
  const me = await requireActor("candidate", "employer");
  if (me.role === "candidate") return { items: await listForCandidate(await candidateProfileId(me.userId)) };
  const { status } = parseQuery(req, statusQuery);
  return { items: await listForEmployer(await employerId(me.userId), status) };
});

export const POST = route(async (req) => {
  const me = await requireActor("employer");
  await limitOrThrow(`invite:${me.userId}`, 60, 3600);
  const input = await parseJson(req, invitationCreateSchema);
  return createInvitation(await employerId(me.userId), me.userId, input);
});
