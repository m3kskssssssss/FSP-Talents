import type { Metadata } from "next";
import { toProfileValues } from "@/components/candidate/values";
import { requireCandidate } from "@/server/http/guard";
import { getMyProfile } from "@/server/services/candidate";
import { Wizard } from "./wizard";

export const metadata: Metadata = { title: "Знакомство" };
export const dynamic = "force-dynamic";

export default async function Onboarding() {
  const me = await requireCandidate();
  const p = await getMyProfile(me.profileId, me.userId);
  const survey = (p.profile.survey ?? {}) as { specialization?: string; interests?: string[]; yearsInSpec?: number };
  return <Wizard initial={toProfileValues(p)} survey={survey} />;
}
