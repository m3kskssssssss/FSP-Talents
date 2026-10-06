import { employerId, requireActor } from "@/server/http/guard";
import { parseJson, parseQuery, route } from "@/server/http/route";
import { vacancyCreateSchema, vacancyListSchema } from "@/server/schemas/vacancies";
import { createVacancy, listEmployerVacancies, listOpenVacancies } from "@/server/services/vacancies";

export const GET = route(async (req) => {
  const me = await requireActor("candidate", "employer");
  const q = parseQuery(req, vacancyListSchema);
  if (me.role === "employer" && q.mine) return { items: await listEmployerVacancies(await employerId(me.userId)) };
  return { items: await listOpenVacancies(q.specialization) };
});

export const POST = route(async (req) => {
  const me = await requireActor("employer");
  return createVacancy(await employerId(me.userId), await parseJson(req, vacancyCreateSchema));
});
