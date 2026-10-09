import type { Metadata } from "next";
import { InterviewList } from "@/components/interviews/interview-list";
import { PageTitle } from "@/components/ui/blank";
import { requireEmployer } from "@/server/http/guard";
import { listInterviews } from "@/server/services/interviews";

export const metadata: Metadata = { title: "Собеседования" };
export const dynamic = "force-dynamic";

export default async function EmployerInterviews() {
  const me = await requireEmployer();
  const items = await listInterviews({ role: "employer", employerId: me.employerId });
  return (
    <div>
      <PageTitle title="Собеседования" back={{ href: "/employer/chats", label: "Чаты" }}>
        Видеособеседования с общим редактором кода. Назначаются из чата с кандидатом.
      </PageTitle>
      <InterviewList role="employer" items={items} />
    </div>
  );
}
