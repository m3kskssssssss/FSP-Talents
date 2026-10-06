import { expect, test } from "@playwright/test";

test("landing and protected areas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Работодатель находит вас сам");
  await page.goto("/candidate");
  await expect(page).toHaveURL(/\/login\?next=%2Fcandidate/);
});

test("register, verify email in demo mode, login", async ({ page }) => {
  const email = `e2e-${Date.now()}@test.ru`;
  await page.goto("/register?role=candidate");
  await page.getByLabel("Имя и фамилия").fill("Тест Тестов");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill("Passw0rd1");
  await page.getByText("Даю согласие на обработку").click();
  await page.getByText("Ознакомлен(а)").click();
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await page.getByRole("link", { name: "Подтвердить email" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Email подтверждён");
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill("Passw0rd1");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/candidate/);
});
