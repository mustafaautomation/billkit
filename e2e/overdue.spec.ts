import { expect, test } from "@playwright/test"
import { login, MAYA, reset } from "./helpers"

test.beforeEach(async ({ request }) => {
  await reset(request)
})

test("overdue invoices show on the dashboard and in the filtered table", async ({ page }) => {
  await login(page, MAYA)
  const overdue = page.getByRole("link", { name: /Overdue/ })
  await expect(overdue).toContainText(/[1-9]/)
  await overdue.click()
  await expect(page).toHaveURL(/status=overdue/)
  await expect(page.getByRole("link", { name: "NW-1044" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "Fieldnote Coffee" })).toBeVisible()
})
