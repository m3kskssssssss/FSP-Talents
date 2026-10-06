import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageTitle } from "@/components/ui/blank";
import { Notice } from "@/components/ui/field";
import { categoryTitle } from "@/lib/format";
import { requireEmployer } from "@/server/http/guard";
import { candidateForEmployer } from "@/server/services/invitations";
import { getNeed } from "@/server/services/needs";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Приглашение" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ profile?: string; need?: string }> }) {
  const { profile, need: needId } = await searchParams;
  const me = await requireEmployer();
  if (!profile) return <Notice tone="error">Не выбран кандидат</Notice>;
  const cand = await candidateForEmployer(me.employerId, me.userId, profile);
  const need = needId ? await getNeed(me.employerId, needId) : null;
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title={`Пригласить: ${cand.displayName}`}>
        <span className="flex flex-wrap items-center gap-1.5">
          {cand.categories.map((c) => (
            <Badge key={c.specialization} tone="solid">
              {categoryTitle(c.specialization, c.grade)}
            </Badge>
          ))}
          <Link className="link text-sm" href={`/employer/candidates/${profile}`}>
            Профиль
          </Link>
        </span>
      </PageTitle>
      <InviteForm
        profileId={profile}
        inviteFloor={cand.inviteFloor}
        needId={need?.id ?? null}
        defaults={{
          title: need?.title ?? "",
          description: need?.teamAbout ?? "",
          salaryFrom: need ? String(need.salaryFrom) : "",
          salaryTo: need ? String(need.salaryTo) : "",
          format: need?.format ?? "",
        }}
      />
    </div>
  );
}
