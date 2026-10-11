import type { Metadata } from "next";
import { InterviewPage } from "@/components/interviews/interview-page";
import { requireCandidate } from "@/server/http/page-guard";

export const metadata: Metadata = { title: "Собеседование" };
export const dynamic = "force-dynamic";

export default async function CandidateInterview({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireCandidate();
  const { id } = await params;
  return <InterviewPage party={{ role: "candidate", profileId: me.profileId }} id={id} />;
}
