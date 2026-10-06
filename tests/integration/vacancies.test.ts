import { beforeEach, describe, expect, it } from "vitest";
import { vacancyCreateSchema } from "@/server/schemas/vacancies";
import { candidateForEmployer } from "@/server/services/invitations";
import { apply, createVacancy, listOpenVacancies, setApplicationStatus, vacancyApplications } from "@/server/services/vacancies";
import { resetDb } from "../helpers/db";
import { makeCandidate, makeCategorized, makeEmployer } from "../helpers/factories";

const v = { title: "Backend-разработчик", description: "Платёжный шлюз, Python, PostgreSQL, высокие нагрузки", specialization: "backend", grade: "middle", salaryFrom: 200000, salaryTo: 280000 };

describe("vacancies and applications", () => {
  beforeEach(resetDb);

  it("requires a salary range (hard rule #1)", () => {
    expect(vacancyCreateSchema.safeParse({ ...v, salaryFrom: undefined }).success).toBe(false);
    expect(vacancyCreateSchema.safeParse({ ...v, salaryFrom: 300000 }).success).toBe(false);
    expect(vacancyCreateSchema.safeParse(v).success).toBe(true);
  });

  it("applying requires a category and discloses contacts to that employer only", async () => {
    const emp = await makeEmployer();
    const other = await makeEmployer();
    const vac = await createVacancy(emp.employerId, vacancyCreateSchema.parse(v));
    expect((await listOpenVacancies("backend")).map((x) => x.v.id)).toEqual([vac.id]);

    const noCat = await makeCandidate();
    await expect(apply(noCat.profileId, noCat.user.id, vac.id)).rejects.toMatchObject({ status: 403 });

    const c = await makeCategorized({ contacts: { email: "app@x.ru" } });
    expect((await candidateForEmployer(emp.employerId, emp.user.id, c.profileId)).contacts).toBeNull();
    const a = await apply(c.profileId, c.user.id, vac.id, "Готов к собеседованию");
    await expect(apply(c.profileId, c.user.id, vac.id)).rejects.toMatchObject({ status: 409 });
    expect((await candidateForEmployer(emp.employerId, emp.user.id, c.profileId)).contacts).toMatchObject({ email: "app@x.ru" });
    expect((await candidateForEmployer(other.employerId, other.user.id, c.profileId)).contacts).toBeNull();

    const list = await vacancyApplications(emp.employerId, vac.id);
    expect(list.items).toHaveLength(1);
    await expect(vacancyApplications(other.employerId, vac.id)).rejects.toMatchObject({ status: 404 });
    await setApplicationStatus(emp.employerId, a.id, "accepted");
    await expect(setApplicationStatus(emp.employerId, a.id, "declined")).rejects.toMatchObject({ status: 409 });
  });
});
