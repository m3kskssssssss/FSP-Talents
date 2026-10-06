import type { getMyProfile } from "@/server/services/candidate";
import type { ProfileValues } from "./profile-form";

type My = Awaited<ReturnType<typeof getMyProfile>>;

export function toProfileValues(me: My): ProfileValues {
  const p = me.profile;
  return {
    fullName: p.fullName ?? "",
    city: p.city ?? "",
    experienceYears: p.experienceYears !== null ? String(p.experienceYears) : "",
    about: p.about ?? "",
    salaryExpectFrom: p.salaryExpectFrom ? String(p.salaryExpectFrom) : "",
    salaryExpectTo: p.salaryExpectTo ? String(p.salaryExpectTo) : "",
    inviteFloor: p.inviteFloor ? String(p.inviteFloor) : "",
    workFormat: p.workFormat ?? "",
    email: me.contacts.email ?? "",
    phone: me.contacts.phone ?? "",
    telegram: me.contacts.telegram ?? "",
    links: (me.contacts.links ?? []).join("\n"),
    skills: me.skills.filter((s) => s.source === "declared").map((s) => s.skill),
  };
}
