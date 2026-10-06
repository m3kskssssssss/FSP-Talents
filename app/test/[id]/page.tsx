import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TestRunner } from "@/components/test/runner";
import { requireCandidate } from "@/server/http/guard";
import { getAttempt } from "@/server/services/testing";

export const metadata: Metadata = { title: "Тест", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireCandidate();
  const state = await getAttempt(me.profileId, id);
  if (state.status !== "in_progress") redirect(`/candidate/attempts/${id}`);
  return <TestRunner initial={JSON.parse(JSON.stringify(state))} />;
}
