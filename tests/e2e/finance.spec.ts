import { test, expect } from "@playwright/test";
test("login, create and edit expense, search and export", async ({ page }) => {
  await page.goto("/login");
  await page
    .getByLabel("E-posta", { exact: true })
    .fill("demo@moneyflow.example");
  await page
    .getByLabel("Şifre", { exact: false })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Merhaba, Deniz 👋" }),
  ).toBeVisible();
  await expect(page.getByText("Toplam bakiye", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yeni kayıt", exact: true }).click();
  const description = `E2E market ${Date.now()}`;
  await page.getByLabel("Açıklama", { exact: true }).fill(description);
  await page.getByLabel("Tutar", { exact: true }).fill("12.34");
  await page
    .getByRole("combobox", { name: "Kategori", exact: true })
    .selectOption({ label: "Market" });
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: description })
    .getByRole("button", { name: "Düzenle" })
    .click();
  await page.getByLabel("Tutar", { exact: true }).fill("15.67");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: description }),
  ).toContainText("15,67");
  await page.getByRole("link", { name: "İşlemler", exact: true }).click();
  await page.getByPlaceholder("İşlem ara…").fill(description);
  await expect(
    page.getByRole("row").filter({ hasText: description }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("moneyflow.csv");
});
test("mobile landing and protected route redirect", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Bugünü yönet. Geleceğine yer aç." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
for (const width of [320, 390, 430]) {
  test(`phone ${width}px: navigation, transaction cards and usable forms`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/login");
    await page
      .getByLabel("E-posta", { exact: true })
      .fill("demo@moneyflow.example");
    await page
      .getByLabel("Şifre", { exact: false })
      .fill(process.env.DEMO_PASSWORD!);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await expect(
      page.getByText("Toplam bakiye", { exact: true }),
    ).toBeVisible();
    const noOverflow = async () => {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
    };
    const dock = page.getByRole("navigation", { name: "Hızlı gezinme" });
    await expect(dock).toBeVisible();
    await noOverflow();
    await page.screenshot({
      path: testInfo.outputPath(`dashboard-${width}.png`),
    });
    await dock.getByRole("link", { name: "İşlemler", exact: true }).click();
    const table = page.getByRole("table", { name: "İşlemler", exact: true });
    await expect(table).toBeVisible();
    await table.getByRole("button", { name: "Düzenle" }).first().scrollIntoViewIfNeeded();
    await expect(
      table.getByRole("button", { name: "Düzenle" }).first(),
    ).toBeInViewport();
    await noOverflow();
    await page.screenshot({
      path: testInfo.outputPath(`transactions-${width}.png`),
    });
    await dock.getByRole("button", { name: "Yeni işlem", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(
      await dialog
        .getByLabel("Açıklama", { exact: true })
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    await dialog
      .getByLabel("Açıklama", { exact: true })
      .fill(`Telefon ${width}px testi`);
    await dialog.getByLabel("Tutar", { exact: true }).fill("5.25");
    await page.screenshot({ path: testInfo.outputPath(`form-${width}.png`) });
    await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(
      page.getByText(`Telefon ${width}px testi`, { exact: true }),
    ).toBeVisible();
    await dock
      .getByRole("button", { name: "Tüm sayfalar", exact: true })
      .click();
    const menu = page.getByRole("dialog", { name: "Menü", exact: true });
    await expect(menu).toBeVisible();
    await menu.getByRole("link", { name: "Raporlar", exact: true }).click();
    await expect(menu).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Raporunu yanında götür" }),
    ).toBeVisible();
    await noOverflow();
    await page.screenshot({
      path: testInfo.outputPath(`reports-${width}.png`),
      fullPage: true,
    });
    await dock
      .getByRole("button", { name: "Tüm sayfalar", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
  });
}
