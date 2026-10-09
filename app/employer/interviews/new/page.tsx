import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScheduleForm } from "@/components/interviews/schedule-form";
import { PageTitle } from "@/components/ui/blank";
import { requireEmployer } from "@/server/http/guard";
import { uuidSchema } from "@/server/schemas/common";
import { listChats } from "@/server/services/chats";

export const metadata: Metadata = { title: "Новое собеседование" };
export const dynamic = "force-dynamic";

export default async function NewInterview({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string }>;
}) {
  const me = await requireEmployer();
  const chatId = uuidSchema.safeParse((await searchParams).chat);
  if (!chatId.success) notFound();
  const chat = (await listChats({ role: "employer", employerId: me.employerId })).find(
    (c) => c.id === chatId.data,
  );
  if (!chat) notFound();
  return (
    <div className="max-w-2xl">
      <PageTitle
        title={`Собеседование: ${chat.with}`}
        meta={chat.title}
        back={{ href: `/employer/chats?chat=${chat.id}`, label: "К чату" }}
      />
      <ScheduleForm chatId={chat.id} candidate={chat.with} />
    </div>
  );
}
