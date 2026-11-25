import { expect, test } from "@playwright/test"
import { reset } from "./helpers"

test.beforeEach(async ({ request }) => {
  await reset(request)
})

test("public demo is readable and cannot mutate", async ({ page }) => {
  await page.goto("/demo")
  await expect(page.getByText("Read-only demo")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible()
  await page.goto("/demo/invoices")
  await expect(page.getByRole("link", { name: "NW-1042" })).toBeVisible()

  await page.goto("/demo/clients/new")
  await page.getByLabel("Name").fill("Should Not Exist")
  await page.getByLabel("Email").fill("nope@example.com")
  await page.getByLabel("Company").fill("Nope Co")
  await page.getByRole("button", { name: "Save client" }).click()
  await expect(page.getByText("This is a read-only demo. Create a free workspace to make changes.")).toBeVisible()

  await page.goto("/demo/clients")
  await expect(page.getByText("Should Not Exist")).toHaveCount(0)
  await expect(page.getByText("Harbor & Co")).toBeVisible()
})

test("demo payment page is a preview and cannot take a payment", async ({ page }) => {
  await page.goto("/demo/invoices/d0000001-0000-4000-8000-000000000002")
  await page.getByRole("link", { name: "Open payment page" }).click()
  await expect(page.getByRole("heading", { name: "NW-1043" })).toBeVisible()
  await expect(page.getByText(/Read-only demo\. This is what the client sees/)).toBeVisible()
  await expect(page.getByRole("button", { name: "Confirm test payment" })).toHaveCount(0)
})

test("marketing page and demo nav work on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(page.getByRole("heading", { name: /still out/i })).toBeVisible()
  await page.goto("/demo")
  await page.getByRole("button", { name: "Open menu" }).click()
  await expect(page.getByRole("link", { name: "Invoices" })).toBeVisible()
})
