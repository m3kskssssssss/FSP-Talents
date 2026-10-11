/**
 * Invitations in every status (sent, viewed, accepted, declined, withdrawn,
 * expired) with a consistent event history. Deterministic and idempotent.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../server/db";
import {
  candidateProfiles,
  employers,
  invitationEvents,
  invitations,
  needs,
  users,
} from "../server/db/schema";
import { DAY_MS } from "../server/lib/time";
import { scoreCandidate } from "../server/matching/score";
import { loadPool, toNeedInput } from "../server/services/matching";
import type { InvitationStatus } from "../server/invitations/fsm";
import { Rng } from "../server/testing/rng";

const STATUSES: [InvitationStatus, number][] = [
  ["sent", 3],
  ["viewed", 2],
  ["accepted", 3],
  ["declined", 2],
  ["withdrawn", 1],
  ["expired", 1],
];
const REASONS = [
  "Сейчас не рассматриваю смену работы",
  "Не подходит формат работы",
  "Ожидания по зарплате выше",
  "Интересна другая предметная область",
];

function pickStatus(rng: Rng): InvitationStatus {
  const total = STATUSES.reduce((s, [, w]) => s + w, 0);
  let r = rng.float() * total;
  for (const [s, w] of STATUSES) if ((r -= w) <= 0) return s;
  return "sent";
}

export async function seedInvitations() {
  const [{ n }] = (await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(invitations)) as [{ n: number }];
  if (n > 0) return;
  const rng = new Rng("seed-invitations-v1");
  const now = Date.now();
  const emps = await db()
    .select({ id: employers.id, userId: employers.userId, email: users.email })
    .from(employers)
    .innerJoin(users, eq(users.id, employers.userId));
  let created = 0;
  for (const e of emps) {
    const isDemo = e.email === "employer@demo.ru";
    const ns = await db().select().from(needs).where(eq(needs.employerId, e.id));
    for (const need of ns.slice(0, 2)) {
      const pool = await loadPool({ spec: need.specialization, grades: [need.grade] });
      const ranked = pool
        .filter((c) => !c.fullName.startsWith("Максим Соколов"))
        .map((c) => ({ c, m: scoreCandidate(toNeedInput(need), c).match }))
        .sort((a, b) => b.m - a.m)
        .slice(0, isDemo ? 5 : rng.int(2, 4));
      for (const [k, { c }] of ranked.entries()) {
        const status: InvitationStatus = isDemo
          ? (["accepted", "viewed", "sent", "declined", "expired"] as const)[k % 5]!
          : pickStatus(rng);
        const createdAt = new Date(now - rng.int(1, 20) * DAY_MS - rng.int(0, 600) * 60_000);
        const viewedAt =
          status === "sent" ||
          (status === "withdrawn" && rng.bool()) ||
          (status === "expired" && rng.bool())
            ? null
            : new Date(createdAt.getTime() + rng.int(1, 48) * 3600_000);
        const decidedAt = ["accepted", "declined", "withdrawn"].includes(status)
          ? new Date((viewedAt ?? createdAt).getTime() + rng.int(1, 72) * 3600_000)
          : null;
        const expiresAt =
          status === "expired"
            ? new Date(createdAt.getTime() + 14 * DAY_MS)
            : new Date(Math.max(now + DAY_MS, createdAt.getTime() + 14 * DAY_MS));
        const [inv] = await db()
          .insert(invitations)
          .values({
            employerId: e.id,
            profileId: c.profileId,
            needId: need.id,
            title: need.title,
            description: need.teamAbout ?? "Подробности расскажем на звонке.",
            salaryFrom: need.salaryFrom,
            salaryTo: need.salaryTo,
            format: need.format,
            status,
            declineReason: status === "declined" ? rng.pick(REASONS) : null,
            createdAt,
            viewedAt,
            decidedAt,
            expiresAt:
              status === "expired"
                ? new Date(Math.min(expiresAt.getTime(), now - DAY_MS))
                : expiresAt,
          })
          .returning();
        const ev: (typeof invitationEvents.$inferInsert)[] = [
          {
            invitationId: inv!.id,
            fromStatus: null,
            toStatus: "sent",
            actorUserId: e.userId,
            at: createdAt,
          },
        ];
        if (viewedAt)
          ev.push({ invitationId: inv!.id, fromStatus: "sent", toStatus: "viewed", at: viewedAt });
        if (decidedAt)
          ev.push({
            invitationId: inv!.id,
            fromStatus: viewedAt ? "viewed" : "sent",
            toStatus: status,
            at: decidedAt,
            note: status === "declined" ? inv!.declineReason : null,
          });
        if (status === "expired")
          ev.push({
            invitationId: inv!.id,
            fromStatus: viewedAt ? "viewed" : "sent",
            toStatus: "expired",
            at: inv!.expiresAt,
          });
        await db().insert(invitationEvents).values(ev);
        created++;
      }
    }
  }
  // strong@demo.ru gets an open invitation from a synthetic company, to show the candidate side.
  const [strong] = await db()
    .select({ profileId: candidateProfiles.id })
    .from(candidateProfiles)
    .innerJoin(users, eq(users.id, candidateProfiles.userId))
    .where(eq(users.email, "strong@demo.ru"));
  const [other] = await db()
    .select({ id: employers.id, userId: employers.userId })
    .from(employers)
    .innerJoin(users, eq(users.id, employers.userId))
    .where(and(inArray(users.email, ["emp01@seed.test"])));
  if (strong && other) {
    const createdAt = new Date(now - 2 * DAY_MS);
    const [inv] = await db()
      .insert(invitations)
      .values({
        employerId: other.id,
        profileId: strong.profileId,
        title: "Senior Python-разработчик (платформа данных)",
        description:
          "Проектирование сервисов приёма событий, 2000 RPS, Kafka и ClickHouse. Команда из 8 человек.",
        salaryFrom: 300000,
        salaryTo: 380000,
        format: "remote",
        createdAt,
        expiresAt: new Date(now + 12 * DAY_MS),
      })
      .returning();
    await db()
      .insert(invitationEvents)
      .values({
        invitationId: inv!.id,
        toStatus: "sent",
        actorUserId: other.userId,
        at: createdAt,
      });
    created++;
  }
  console.log(`invitations: ${created}`);
}

/** A few classic vacancies with applications (additional feature). */
export async function seedVacancies() {
  const { vacancies, applications, categories } = await import("../server/db/schema");
  const [{ n }] = (await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(vacancies)) as [{ n: number }];
  if (n > 0) return;
  const rng = new Rng("seed-vacancies-v1");
  const ns = await db().select().from(needs).limit(14);
  let apps = 0;
  for (const need of ns) {
    const [v] = await db()
      .insert(vacancies)
      .values({
        employerId: need.employerId,
        title: need.title,
        description:
          `${need.teamAbout ?? ""} Ищем специалиста в команду: стек ${need.stack.join(", ")}.`.trim(),
        specialization: need.specialization,
        grade: need.grade,
        stack: need.stack,
        salaryFrom: need.salaryFrom,
        salaryTo: need.salaryTo,
        format: need.format,
        city: need.city,
      })
      .returning();
    const cands = await db()
      .select({ profileId: categories.profileId })
      .from(categories)
      .where(
        and(eq(categories.specialization, need.specialization), eq(categories.status, "active")),
      )
      .limit(30);
    for (const c of rng.sample(cands, Math.min(cands.length, rng.int(0, 3)))) {
      await db()
        .insert(applications)
        .values({
          vacancyId: v!.id,
          profileId: c.profileId,
          coverLetter: "Интересна задача, готов к созвону.",
          status: rng.pick(["sent", "viewed", "accepted", "declined"] as const),
        })
        .onConflictDoNothing();
      apps++;
    }
  }
  console.log(`vacancies: ${ns.length}, applications: ${apps}`);
}

/**
 * Chats for every accepted invitation and application (the app opens them at
 * that moment), with a short conversation for the demo accounts: employer@demo.ru
 * on its first accepted invitation, strong@demo.ru with a synthetic company.
 */
export async function seedChats() {
  const { applications, chatMessages, chats, vacancies } = await import("../server/db/schema");
  const [{ n }] = (await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(chats)) as [{ n: number }];
  if (n > 0) return;
  const now = Date.now();
  const accepted = [
    ...(
      await db()
        .select({
          employerId: invitations.employerId,
          profileId: invitations.profileId,
          title: invitations.title,
          at: invitations.decidedAt,
        })
        .from(invitations)
        .where(eq(invitations.status, "accepted"))
    ).map((r) => ({
      ...r,
      reason: `Кандидат принял приглашение «${r.title}». Теперь можно договориться о встрече здесь.`,
    })),
    ...(
      await db()
        .select({
          employerId: vacancies.employerId,
          profileId: applications.profileId,
          title: vacancies.title,
          at: applications.createdAt,
        })
        .from(applications)
        .innerJoin(vacancies, eq(vacancies.id, applications.vacancyId))
        .where(eq(applications.status, "accepted"))
    ).map((r) => ({
      ...r,
      reason: `Компания пригласила вас по отклику на вакансию «${r.title}». Обсудите детали здесь.`,
    })),
  ];

  // strong@demo.ru: an accepted invitation from another synthetic company, so the candidate side has a live chat too.
  const [strong] = await db()
    .select({ profileId: candidateProfiles.id })
    .from(candidateProfiles)
    .innerJoin(users, eq(users.id, candidateProfiles.userId))
    .where(eq(users.email, "strong@demo.ru"));
  const [emp2] = await db()
    .select({ id: employers.id, userId: employers.userId })
    .from(employers)
    .innerJoin(users, eq(users.id, employers.userId))
    .where(eq(users.email, "emp02@seed.test"));
  let strongPair: { employerId: string; profileId: string } | null = null;
  if (strong && emp2) {
    const decidedAt = new Date(now - 26 * 3600_000);
    const createdAt = new Date(now - 3 * DAY_MS);
    const title = "Middle Backend-разработчик (платёжные сервисы)";
    const [inv] = await db()
      .insert(invitations)
      .values({
        employerId: emp2.id,
        profileId: strong.profileId,
        title,
        description:
          "Сервис расчётов с банками-партнёрами: Python, PostgreSQL, Kafka. Команда из 6 человек.",
        salaryFrom: 270000,
        salaryTo: 330000,
        format: "hybrid",
        status: "accepted",
        createdAt,
        viewedAt: new Date(createdAt.getTime() + 3600_000),
        decidedAt,
        expiresAt: new Date(now + 11 * DAY_MS),
      })
      .returning();
    await db()
      .insert(invitationEvents)
      .values([
        { invitationId: inv!.id, toStatus: "sent", actorUserId: emp2.userId, at: createdAt },
        { invitationId: inv!.id, fromStatus: "sent", toStatus: "viewed", at: inv!.viewedAt! },
        { invitationId: inv!.id, fromStatus: "viewed", toStatus: "accepted", at: decidedAt },
      ]);
    strongPair = { employerId: emp2.id, profileId: strong.profileId };
    accepted.push({
      ...strongPair,
      title,
      at: decidedAt,
      reason: `Кандидат принял приглашение «${title}». Теперь можно договориться о встрече здесь.`,
    });
  }

  const [demoEmp] = await db()
    .select({ id: employers.id })
    .from(employers)
    .innerJoin(users, eq(users.id, employers.userId))
    .where(eq(users.email, "employer@demo.ru"));
  const seen = new Set<string>();
  let demoDone = false;
  for (const a of accepted) {
    const pair = `${a.employerId}:${a.profileId}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    const opened = a.at ?? new Date(now - 2 * DAY_MS);
    const script =
      strongPair && a.employerId === strongPair.employerId && a.profileId === strongPair.profileId
        ? [
            [
              "employer",
              "Максим, добрый день! Спасибо, что приняли приглашение. Удобно созвониться в четверг в 15:00?",
              20,
            ],
            [
              "candidate",
              "Добрый день! Четверг подходит. Пришлите, пожалуйста, ссылку на встречу.",
              60,
            ],
            [
              "employer",
              "Отправил приглашение в календарь. На звонке будут тимлид и CTO, минут 40.",
              90,
            ],
          ]
        : a.employerId === demoEmp?.id && !demoDone
          ? [
              [
                "employer",
                "Здравствуйте! Рады, что позиция вам интересна. Расскажете о последнем проекте?",
                30,
              ],
              [
                "candidate",
                "Здравствуйте! Последний год делаю сервис биллинга: Python, PostgreSQL, очереди на Kafka.",
                120,
              ],
            ]
          : [];
    if (a.employerId === demoEmp?.id) demoDone = true;
    const last = script.length
      ? new Date(opened.getTime() + (script[script.length - 1]![2] as number) * 60_000)
      : opened;
    const [chat] = await db()
      .insert(chats)
      .values({
        employerId: a.employerId,
        profileId: a.profileId,
        title: a.title,
        lastMessageAt: last,
        createdAt: opened,
        employerReadAt: last,
      })
      .returning({ id: chats.id });
    await db()
      .insert(chatMessages)
      .values([
        { chatId: chat!.id, author: "system" as const, body: a.reason, createdAt: opened },
        ...script.map(([author, body, min]) => ({
          chatId: chat!.id,
          author: author as "employer" | "candidate",
          body: body as string,
          createdAt: new Date(opened.getTime() + (min as number) * 60_000),
        })),
      ]);
  }
  console.log(`chats: ${seen.size}`);
}

/**
 * Regular challenges of the demo employer: graded answers of a few Backend ·
 * Middle candidates (the "fresh signal" in the demo need's selection), two
 * answers waiting for the employer's grade, and an old one for strong@demo.ru,
 * so opening "Задачи" offers a new task right away.
 */
export async function seedChallenges() {
  const { categories, challengeAssignments, challenges } = await import("../server/db/schema");
  const [{ n }] = (await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(challenges)) as [{ n: number }];
  if (n > 0) return;
  const [demoEmp] = await db()
    .select({ id: employers.id })
    .from(employers)
    .innerJoin(users, eq(users.id, employers.userId))
    .where(eq(users.email, "employer@demo.ru"));
  if (!demoEmp) return;
  const now = Date.now();
  const rows = await db()
    .insert(challenges)
    .values([
      {
        employerId: demoEmp.id,
        title: "Дубли платежей",
        statement:
          "Таблица payments(id, user_id, amount) содержит строки (1, 10, 500), (2, 10, 500), (3, 11, 900), (4, 12, 100), (5, 12, 100), (6, 12, 250).\nСколько строк вернёт запрос:\nSELECT user_id FROM payments GROUP BY user_id HAVING count(*) > 1;\nВ ответе — одно число.",
        specialization: "backend" as const,
        grade: null,
        kind: "exact" as const,
        expectedAnswer: "2",
        createdAt: new Date(now - 40 * DAY_MS),
      },
      {
        employerId: demoEmp.id,
        title: "Кеш курсов валют",
        statement:
          "Платёжный шлюз на каждый платёж ходит во внешний сервис за курсом валют (p99 — 800 мс, лимит 50 запросов в секунду). Нагрузка — 400 платежей в секунду.\nПредложите, как кешировать курсы: где хранить, как обновлять, что делать при недоступности сервиса и как не списать деньги по устаревшему курсу. Достаточно 5–10 предложений.",
        specialization: "backend" as const,
        grade: "middle" as const,
        kind: "open" as const,
        expectedAnswer: null,
        createdAt: new Date(now - 35 * DAY_MS),
      },
      {
        employerId: demoEmp.id,
        title: "Ретраи без двойного списания",
        statement:
          "Клиент повторяет запрос на оплату после таймаута. Как сделать так, чтобы деньги не списались дважды? Опишите схему на уровне API и базы данных.",
        specialization: "backend" as const,
        grade: null,
        kind: "open" as const,
        expectedAnswer: null,
        createdAt: new Date(now - 30 * DAY_MS),
      },
      {
        employerId: demoEmp.id,
        title: "Медленная таблица заказов",
        statement:
          "Страница со списком из 5 000 заказов тормозит при вводе в поле поиска. Предложите, что проверить и как ускорить: рендеринг, фильтрация, запросы.",
        specialization: "frontend" as const,
        grade: null,
        kind: "open" as const,
        expectedAnswer: null,
        createdAt: new Date(now - 28 * DAY_MS),
      },
    ])
    .returning({ id: challenges.id, title: challenges.title });
  const byTitle = new Map(rows.map((r) => [r.title, r.id]));
  const pool = await db()
    .select({ profileId: categories.profileId })
    .from(categories)
    .where(
      and(
        eq(categories.status, "active"),
        eq(categories.specialization, "backend"),
        eq(categories.grade, "middle"),
      ),
    )
    .orderBy(categories.profileId)
    .limit(10);
  const rng = new Rng("challenges");
  const approach = [
    "Держать курсы в Redis с TTL 30 с и обновлять фоновым воркером раз в 10 с, а не по запросу платежа: так во внешний сервис уходит 0,1 запроса в секунду. В платёж записывать курс и время его получения. Если курс старше 2 минут — не проводить платёж по нему, а ставить в очередь на повтор. При недоступности сервиса — circuit breaker и алерт.",
    "Ключ идемпотентности от клиента в заголовке, уникальный индекс в таблице платежей. Повтор с тем же ключом возвращает сохранённый ответ, а не создаёт списание. Статусы платежа через конечный автомат, списание — в транзакции с записью ключа.",
  ];
  const values = pool.map((p, i) => {
    const waiting = i < 2;
    const exact = i % 3 === 2;
    const offeredAt = new Date(now - (waiting ? 3 : 4 + i * 2) * DAY_MS);
    const submittedAt = new Date(offeredAt.getTime() + 5 * 3600_000);
    const score = exact ? (rng.float() < 0.8 ? 3 : 0) : 2 + Math.round(rng.float());
    return {
      challengeId: byTitle.get(exact ? "Дубли платежей" : i % 2 ? "Ретраи без двойного списания" : "Кеш курсов валют")!,
      profileId: p.profileId,
      status: waiting ? ("submitted" as const) : ("graded" as const),
      answer: exact ? (score ? "2" : "3") : approach[i % 2]!,
      score: waiting ? null : score,
      feedback: waiting ? null : exact ? (score ? "Ответ совпал с эталоном" : "Ответ не совпал с эталоном") : "Хороший разбор, обсудим на интервью.",
      offeredAt,
      submittedAt,
      gradedAt: waiting ? null : new Date(submittedAt.getTime() + DAY_MS),
    };
  });
  const [strong] = await db()
    .select({ profileId: candidateProfiles.id })
    .from(candidateProfiles)
    .innerJoin(users, eq(users.id, candidateProfiles.userId))
    .where(eq(users.email, "strong@demo.ru"));
  if (strong) {
    const offeredAt = new Date(now - 20 * DAY_MS);
    values.push({
      challengeId: byTitle.get("Дубли платежей")!,
      profileId: strong.profileId,
      status: "graded",
      answer: "2",
      score: 3,
      feedback: "Ответ совпал с эталоном",
      offeredAt,
      submittedAt: new Date(offeredAt.getTime() + 2 * 3600_000),
      gradedAt: new Date(offeredAt.getTime() + 2 * 3600_000),
    });
  }
  await db().insert(challengeAssignments).values(values).onConflictDoNothing();
  console.log(`challenges: ${rows.length}, answers: ${values.length}`);
}
