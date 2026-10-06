import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/blank";
import { requireCandidate } from "@/server/http/guard";
import { getMyProfile } from "@/server/services/candidate";
import { FspManager } from "./manager";

export const metadata: Metadata = { title: "ФСП" };
export const dynamic = "force-dynamic";

export default async function FspPage() {
  const me = await requireCandidate();
  const p = await getMyProfile(me.profileId, me.userId);
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="ФСП ID и достижения">
        Достижения поднимают вас внутри вашей категории. Подтверждённые реестром ФСП весят больше всего; заявленные самостоятельно — минимально.
      </PageTitle>
      <FspManager fspId={p.profile.fspId} achievements={JSON.parse(JSON.stringify(p.achievements))} />
    </div>
  );
}
