import { expect, test } from "@playwright/test"
import { HARBOR_INVOICE, LEAH, login, MAYA, reset } from "./helpers"

test.beforeEach(async ({ request }) => {
  await reset(request)
})

test("one tenant cannot read another tenant's invoice", async ({ browser }) => {
  const northwind = await browser.newContext()
  const cedar = await browser.newContext()
  const maya = await northwind.newPage()
  const leah = await cedar.newPage()

  await login(maya, MAYA)
  await login(leah, LEAH)

  await maya.goto("/app/invoices")
  await expect(maya.getByRole("cell", { name: "Harbor & Co" }).first()).toBeVisible()
  await expect(maya.getByRole("cell", { name: "Hart Family Trust" })).toHaveCount(0)

  await leah.goto("/app/invoices")
  await expect(leah.getByRole("cell", { name: "Harbor & Co" })).toHaveCount(0)
  await expect(leah.getByRole("cell", { name: "Plover Manufacturing" }).first()).toBeVisible()

  await leah.goto(`/app/invoices/${HARBOR_INVOICE}`)
  await expect(leah.getByRole("heading", { name: /not found/i })).toBeVisible()

  await northwind.close()
  await cedar.close()
})
