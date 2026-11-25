import { expect, test } from "@playwright/test"
import { LEAH, login, reset } from "./helpers"

test.beforeEach(async ({ request }) => {
  await reset(request)
})

test("client pays a sent invoice in mock checkout", async ({ page }) => {
  await page.goto("/pay/pay_cl_2202_plover")
  await expect(page.getByRole("heading", { name: "CL-2202" })).toBeVisible()
  await page.getByRole("button", { name: "Confirm test payment" }).click()
  await expect(page.getByText("Payment recorded")).toBeVisible()

  await login(page, LEAH)
  await page.goto("/app/invoices?status=paid")
  await expect(page.getByRole("link", { name: "CL-2202" })).toBeVisible()
})
