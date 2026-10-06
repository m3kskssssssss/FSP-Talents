import type { Metadata } from "next";
import { toProfileValues } from "@/components/candidate/values";
import { PageTitle } from "@/components/ui/blank";
import { requireCandidate } from "@/server/http/guard";
import { getMyProfile } from "@/server/services/candidate";
import { ProfileEditor } from "./editor";

export const metadata: Metadata = { title: "Профиль" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await requireCandidate();
  const p = await getMyProfile(me.profileId, me.userId);
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Профиль" />
      <ProfileEditor initial={toProfileValues(p)} />
    </div>
  );
}
