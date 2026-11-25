import { expect, type Page } from "@playwright/test"

export const PASSWORD = "ledger-demo-2026"
export const MAYA = "maya@northwind.studio"
export const LEAH = "leah@cedar.legal"
export const HARBOR_INVOICE = "d0000001-0000-4000-8000-000000000001"

export async function reset(request: { post: (url: string) => Promise<{ ok: () => boolean }> }) {
  const response = await request.post("/api/test/reset")
  expect(response.ok()).toBeTruthy()
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Log in" }).click()
  await expect(page).toHaveURL(/\/app/)
}
