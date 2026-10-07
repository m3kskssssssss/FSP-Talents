import type { Party } from "../services/chats";
import { candidateProfileId, employerId, requireActor } from "./guard";

/** The current user as a chat party: chats exist only between candidates and employers. */
export async function requireParty(): Promise<Party & { userId: string }> {
  const a = await requireActor("candidate", "employer");
  return a.role === "employer"
    ? { role: "employer", employerId: await employerId(a.userId), userId: a.userId }
    : { role: "candidate", profileId: await candidateProfileId(a.userId), userId: a.userId };
}
