import { requireCandidate } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { renderResumePdf } from "@/server/pdf/resume";
import { getMyProfile } from "@/server/services/candidate";

export const maxDuration = 30;

/** Generated PDF resume from the profile (no LLM). */
export const GET = route(async () => {
  const me = await requireCandidate();
  const p = await getMyProfile(me.profileId, me.userId);
  const pdf = await renderResumePdf({
    fullName: p.profile.fullName || "Кандидат",
    city: p.profile.city,
    experienceYears: p.profile.experienceYears,
    about: p.profile.about,
    workFormat: p.profile.workFormat,
    salary: { from: p.profile.salaryExpectFrom, to: p.profile.salaryExpectTo },
    contacts: p.contacts,
    categories: p.categories,
    skills: p.skills,
    achievements: p.achievements,
  });
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="resume.pdf"`, "Cache-Control": "no-store" },
  });
});
