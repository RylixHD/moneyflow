import { test, expect } from "@playwright/test";

test("phone registration: discover, validate, submit and verify instructions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  let submissions = 0;
  await page.route("**/api/auth/register", async (route) => {
    submissions++;
    expect(route.request().postDataJSON()).toEqual({
      name: "Yeni Kullanıcı",
      email: "new@example.test",
      password: "valid-password-123",
    });
    await route.fulfill({
      json: { message: "Doğrulama bağlantısı gönderildi." },
      status: 201,
    });
  });
  await page.goto("/login");
  await page.getByRole("link", { name: "Hesap oluştur", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hesabını oluştur." }),
  ).toBeVisible();
  await page.getByLabel("Ad soyad", { exact: true }).fill("Yeni Kullanıcı");
  await page.getByLabel("E-posta", { exact: true }).fill("new@example.test");
  await page.getByLabel("Şifre", { exact: true }).fill("valid-password-123");
  await page
    .getByLabel("Şifre tekrarı", { exact: true })
    .fill("wrong-password-123");
  await page
    .getByRole("button", { name: "Hesap oluştur", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Şifreler eşleşmiyor");
  expect(submissions).toBe(0);
  await page
    .getByLabel("Şifre tekrarı", { exact: true })
    .fill("valid-password-123");
  await page
    .getByRole("button", { name: "Hesap oluştur", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "E-postanı kontrol et." }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("new@example.test");
  expect(submissions).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("link", { name: "Giriş ekranına dön" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("registration server errors keep the form available", async ({ page }) => {
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "Kayıt için SMTP e-posta servisini yapılandırın." },
    }),
  );
  await page.goto("/register");
  await page.getByLabel("Ad soyad", { exact: true }).fill("Yeni Kullanıcı");
  await page.getByLabel("E-posta", { exact: true }).fill("new@example.test");
  await page.getByLabel("Şifre", { exact: true }).fill("valid-password-123");
  await page
    .getByLabel("Şifre tekrarı", { exact: true })
    .fill("valid-password-123");
  await page
    .getByRole("button", { name: "Hesap oluştur", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("SMTP");
  await expect(
    page.getByRole("button", { name: "Hesap oluştur", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("E-posta", { exact: true })).toHaveValue(
    "new@example.test",
  );
});
