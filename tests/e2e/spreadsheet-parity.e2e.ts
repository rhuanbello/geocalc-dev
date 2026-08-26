import { expect, test } from "@playwright/test";

test("mantém o balanço hídrico calculável com os valores da planilha", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("GeoCalc", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Balanço Hídrico/i })).toBeVisible();

  const rows = [
    ["Janeiro", "111", "24,7"], ["Fevereiro", "107", "24.6"], ["Março", "94", "23.5"], ["Abril", "104", "20.2"],
    ["Maio", "102", "17"], ["Junho", "137", "14.5"], ["Julho", "121", "14.1"], ["Agosto", "122", "15.4"],
    ["Setembro", "135", "16.6"], ["Outubro", "117", "19.2"], ["Novembro", "93", "21.4"], ["Dezembro", "97", "23.3"],
  ];
  for (const [month, precipitation, temperature] of rows) {
    await page.getByLabel(`Precipitação de ${month}`).fill(precipitation);
    await page.getByLabel(`Temperatura de ${month}`).fill(temperature);
  }

  const report = page.locator(".report-panel textarea");
  await expect(report).toContainText("Precipitação total: 1.340,0 mm");
  await expect(report).toContainText("ETP corrigida total: 941,9 mm");
  await expect(report).toContainText("Balanço hídrico anual: 398,1 mm");
  await expect(page.getByRole("button", { name: /Exportar Excel/i })).toBeVisible();
});

test("percorre a EUPS-base manual sem fontes espaciais", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Perda de Solos (EUPS)" }).click();

  await expect(page.getByRole("heading", { name: "Perda de Solo (EUPS)", exact: true })).toBeVisible();
  await expect(page.getByText("Conceitos básicos e metodologia")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chuva e erosividade" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Erosão laminar", exact: true })).toBeVisible();
  await expect(page.getByText(/Etapa 0/)).toHaveCount(0);
  await expect(page.getByText("Mapa de erosividade")).toHaveCount(0);
  await expect(page.getByText("Importar precipitação")).toHaveCount(0);

  const rainfall = [208, 168, 260, 225, 208, 272, 45, 26, 42, 36, 42, 26];
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  for (const [index, month] of months.entries()) {
    await page.getByLabel(`Precipitação de ${month}`).fill(String(rainfall[index]));
  }

  await page.getByRole("combobox", { name: "Referência de tipo de solo" }).click();
  await page.getByText("Areia quartzosa", { exact: true }).click();
  await expect(page.getByLabel("Fator K")).toHaveValue("0,027");
  await page.getByLabel("Comprimento da vertente L").fill("120");
  await page.getByLabel("Declividade S").fill("20");
  await page.getByRole("combobox", { name: "Referência de cobertura e manejo" }).click();
  await page.getByText("Solo exposto, sem práticas", { exact: true }).click();

  await expect(page.locator(".eups-final-table")).toContainText("1.519,61");
  await expect(page.getByText("Potencial natural de erosão")).toHaveCount(0);
  await expect(page.getByText(/Todos os fatores necessários foram informados/)).toBeVisible();
});
