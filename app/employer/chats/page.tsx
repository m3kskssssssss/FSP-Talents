import type { Metadata } from "next";
import Link from "next/link";
import { ChatApp } from "@/components/chat/chat-app";
import { PageTitle } from "@/components/ui/blank";
import { requireEmployer } from "@/server/http/page-guard";
import { uuidSchema } from "@/server/schemas/common";
import { chatIdFor } from "@/server/services/chats";

export const metadata: Metadata = { title: "Чаты" };
export const dynamic = "force-dynamic";

export default async function ChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string; with?: string }>;
}) {
  const me = await requireEmployer();
  const sp = await searchParams;
  // ?with=<profileId> opens the chat with that candidate (links from vacancies and the candidate card)
  const withId = uuidSchema.safeParse(sp.with);
  const chat = sp.chat ?? (withId.success ? await chatIdFor(me.employerId, withId.data) : null);
  return (
    <div>
      <PageTitle title="Чаты">
        Переписка с кандидатами. Чат открывается, когда кандидат принимает приглашение или вы
        принимаете его отклик. Видеособеседование назначается кнопкой в шапке переписки.{" "}
        <Link href="/employer/interviews" className="text-accent hover:underline">
          Все собеседования
        </Link>
      </PageTitle>
      <ChatApp key={chat ?? "list"} role="employer" initialChatId={chat} />
    </div>
  );
}
