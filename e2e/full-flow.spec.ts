import { expect, test, type Page } from "@playwright/test";
import { closeDb, solutionFor } from "./helpers";

/**
 * Hackathon acceptance scenario:
 * registration -> email verification -> test -> category -> employer finds
 * the candidate -> invitation with salary -> candidate accepts -> contacts open.
 */
test.afterAll(closeDb);

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
}

test("full flow: register -> test -> category -> invite -> accept -> contacts", async ({ browser }) => {
  test.setTimeout(10 * 60_000);
  const stamp = Date.now();
  const email = `e2e-${stamp}@test.ru`;
  const phone = `+7 900 ${String(stamp).slice(-3)}-00-11`;
  // Unique first name: the employer sees only "Имя Ф." before acceptance.
  const firstName = `Эдуард${String(stamp).slice(-5)}`;
  const cand = await (await browser.newContext()).newPage();

  // 1. Registration and email verification (demo mode shows the link).
  await cand.goto("/register?role=candidate");
  await cand.getByLabel("Имя и фамилия").fill(`${firstName} Сквозной`);
  await cand.getByLabel("Email").fill(email);
  await cand.getByLabel("Пароль").fill("Passw0rd1");
  await cand.getByText("Даю согласие на обработку").click();
  await cand.getByText("Ознакомлен(а)").click();
  await cand.getByRole("button", { name: "Зарегистрироваться" }).click();
  await cand.getByRole("link", { name: "Подтвердить email" }).click();
  await expect(cand.getByRole("heading", { level: 1 })).toHaveText("Email подтверждён");
  await login(cand, email, "Passw0rd1");
  await expect(cand).toHaveURL(/\/candidate/);

  // 2. Contacts (hidden from employers until acceptance).
  await cand.goto("/candidate/profile");
  await cand.getByLabel("Телефон").fill(phone);
  await cand.getByLabel("Город").fill("Казань");
  await cand.getByRole("button", { name: "Сохранить" }).click();
  await expect(cand).toHaveURL(/\/candidate$/);

  // 3. Adaptive test: Backend · Junior, answered with reference solutions.
  await cand.goto("/candidate/test?spec=backend&grade=junior");
  const card = cand.locator("section", { hasText: "Backend" }).first();
  await card.getByText("Я ознакомлен").click();
  await card.getByRole("button", { name: /Начать тест/ }).click();
  await expect(cand).toHaveURL(/\/test\//);
  await cand.getByRole("button", { name: "Начать" }).click();
  const attemptId = cand.url().split("/test/")[1]!;

  for (let i = 0; i < 20 && cand.url().includes("/test/"); i++) {
    const state = await (await cand.request.get(`/api/v1/tests/attempts/${attemptId}`)).json();
    if (state.status !== "in_progress" || !state.current) break;
    const sol = await solutionFor(state.current.itemId);
    if (sol.kind === "code" || sol.kind === "sql") {
      if (sol.kind === "code") await cand.getByRole("radio", { name: "JavaScript" }).click();
      const editor = cand.locator(".cm-content");
      await editor.click();
      await cand.keyboard.press("ControlOrMeta+a");
      await cand.keyboard.press("Delete");
      await cand.keyboard.insertText(sol.code);
    } else if (sol.kind === "calc") {
      await cand.getByLabel("Ваш ответ").fill(sol.value);
    } else {
      for (const t of sol.texts) await cand.locator("label", { hasText: t }).first().click();
    }
    const position = state.answered;
    await cand.getByRole("button", { name: "Отправить ответ" }).click();
    await expect
      .poll(async () => {
        if (!cand.url().includes("/test/")) return true;
        const s = await (await cand.request.get(`/api/v1/tests/attempts/${attemptId}`)).json();
        return s.status !== "in_progress" || s.answered > position;
      }, { timeout: 60_000 })
      .toBe(true);
  }
  await expect(cand).toHaveURL(/\/candidate\/attempts\//, { timeout: 30_000 });
  await expect(cand.getByRole("heading", { level: 1 })).toHaveText("Тест сдан");
  await expect(cand.getByText("Вам присвоена категория")).toBeVisible();

  // 4. Employer finds the candidate in the base search and invites with a salary range.
  const emp = await (await browser.newContext()).newPage();
  await login(emp, "employer@demo.ru", "Demo12345");
  await expect(emp).toHaveURL(/\/employer/);
  await emp.goto("/employer/search");
  await emp.getByRole("button", { name: "Junior" }).click();
  await emp.getByRole("button", { name: "Найти" }).click();
  await expect(emp).toHaveURL(/\/employer\/searches\//);
  const candCard = emp.locator("article", { hasText: `${firstName} С.` });
  await expect(candCard).toBeVisible();
  await expect(emp.getByText(phone)).toHaveCount(0);
  await candCard.getByRole("link", { name: "Пригласить" }).click();
  await emp.getByLabel("Должность").fill("Junior Python-разработчик");
  await emp.getByLabel("Описание задачи").fill("Сервис уведомлений, наставник в команде");
  // Without the salary range the API refuses (hard rule #1).
  await emp.getByRole("button", { name: "Отправить приглашение" }).click();
  await expect(emp.getByText(/Зарплата «от»/).first()).toBeVisible();
  await emp.getByLabel("От", { exact: true }).fill("110000");
  await emp.getByLabel("До", { exact: true }).fill("150000");
  await emp.getByRole("button", { name: "Отправить приглашение" }).click();
  await expect(emp).toHaveURL(/\/employer\/invitations\//);
  await expect(emp.getByText("Контакты откроются, когда кандидат примет приглашение.")).toBeVisible();
  const invitationUrl = emp.url();

  // 5. Candidate accepts.
  await cand.goto("/candidate/invitations");
  await cand.getByText("ООО «Кванта Софт»").first().click();
  await expect(cand.getByText("110 000 – 150 000 ₽")).toBeVisible();
  await cand.getByRole("button", { name: "Принять и открыть контакты" }).click();
  await expect(cand.getByText("Вы приняли приглашение")).toBeVisible();

  // 6. Employer now sees the contacts.
  await emp.goto(invitationUrl);
  await expect(emp.getByText(phone)).toBeVisible();
  await expect(emp.getByText(email)).toBeVisible();
});
