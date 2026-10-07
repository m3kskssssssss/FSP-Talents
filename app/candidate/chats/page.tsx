import type { Metadata } from "next";
import { ChatApp } from "@/components/chat/chat-app";
import { PageTitle } from "@/components/ui/blank";
import { requireCandidate } from "@/server/http/guard";

export const metadata: Metadata = { title: "Чаты" };
export const dynamic = "force-dynamic";

export default async function ChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string }>;
}) {
  await requireCandidate();
  const { chat } = await searchParams;
  return (
    <div>
      <PageTitle title="Чаты">
        Переписка с компаниями. Чат открывается, когда вы принимаете приглашение или компания
        принимает ваш отклик.
      </PageTitle>
      <ChatApp key={chat ?? "list"} role="candidate" initialChatId={chat ?? null} />
    </div>
  );
}
