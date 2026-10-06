import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/blank";
import { requireCandidate } from "@/server/http/guard";
import { contactAccessLog, getMyProfile } from "@/server/services/candidate";
import { PrivacySettings } from "./settings";

export const metadata: Metadata = { title: "Приватность" };
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const me = await requireCandidate();
  const p = await getMyProfile(me.profileId, me.userId);
  const log = await contactAccessLog(me.profileId);
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Приватность и согласия">
        Управляйте видимостью профиля, согласиями (152-ФЗ) и смотрите, какие компании получили ваши контакты.
      </PageTitle>
      <PrivacySettings visibility={p.profile.visibility} consents={JSON.parse(JSON.stringify(p.consents))} log={JSON.parse(JSON.stringify(log))} />
    </div>
  );
}
