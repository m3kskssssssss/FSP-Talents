import type { Metadata } from "next";
import { InterviewPage } from "@/components/interviews/interview-page";
import { requireEmployer } from "@/server/http/page-guard";

export const metadata: Metadata = { title: "Собеседование" };
export const dynamic = "force-dynamic";

export default async function EmployerInterview({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireEmployer();
  const { id } = await params;
  return <InterviewPage party={{ role: "employer", employerId: me.employerId }} id={id} />;
}
