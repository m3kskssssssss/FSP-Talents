import type { Metadata } from "next";
import { InterviewList } from "@/components/interviews/interview-list";
import { PageTitle } from "@/components/ui/blank";
import { requireCandidate } from "@/server/http/page-guard";
import { listInterviews } from "@/server/services/interviews";

export const metadata: Metadata = { title: "Собеседования" };
export const dynamic = "force-dynamic";

export default async function CandidateInterviews() {
  const me = await requireCandidate();
  const items = await listInterviews({ role: "candidate", profileId: me.profileId });
  return (
    <div>
      <PageTitle title="Собеседования" back={{ href: "/candidate/chats", label: "Чаты" }}>
        Видеособеседования, которые назначили компании. Комната открывается за 15 минут до начала.
      </PageTitle>
      <InterviewList role="candidate" items={items} />
    </div>
  );
}
