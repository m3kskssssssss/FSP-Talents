import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DesktopOnlyNotice } from "@/components/layout/desktop-only";
import { PageTitle } from "@/components/ui/blank";
import { isMobileRequest } from "@/server/http/device";
import { TestRunner } from "@/components/test/runner";
import { requireCandidate } from "@/server/http/page-guard";
import { getAttempt } from "@/server/services/testing";

export const metadata: Metadata = { title: "Тест", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireCandidate();
  const state = await getAttempt(me.profileId, id);
  if (state.status !== "in_progress") redirect(`/candidate/attempts/${id}`);
  if (isMobileRequest(await headers()))
    return (
      <div className="max-w-2xl">
        <PageTitle title="Тест" />
        <DesktopOnlyNotice>
          Тест проходится только с компьютера: откройте эту страницу на ПК, чтобы продолжить. Таймер
          попытки идёт.
        </DesktopOnlyNotice>
      </div>
    );
  return <TestRunner initial={JSON.parse(JSON.stringify(state))} />;
}
