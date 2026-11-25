import { expect, test } from "@playwright/test"
import { login, MAYA, reset } from "./helpers"

test.beforeEach(async ({ request }) => {
  await reset(request)
})

test("create and send an invoice", async ({ page }) => {
  await login(page, MAYA)
  await page.goto("/app/invoices/new")
  await page.getByLabel("Client").selectOption({ label: "Harbor & Co · Priya Raman" })
  await page.getByLabel("Description").fill("E2E discovery workshop")
  await page.getByLabel("Quantity").fill("2")
  await page.getByRole("textbox", { name: "Rate", exact: true }).fill("1500")
  await page.getByRole("button", { name: "Save and send" }).click()
  await expect(page.getByText("E2E discovery workshop")).toBeVisible()
  await expect(page.getByText("sent", { exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Open payment page" })).toBeVisible()
})
