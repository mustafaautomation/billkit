import { expect, test } from "@playwright/test"
import { login, reset } from "./helpers"

test.beforeEach(async ({ request }) => {
  await reset(request)
})

test("signup, login, password reset, and magic link", async ({ page }) => {
  const email = `ada.${Date.now()}@example.com`
  const password = "studio-ledger-pass"
  const replacement = "studio-ledger-next"

  await page.goto("/signup")
  await page.getByLabel("Full name").fill("Ada Example")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByLabel("Workspace name").fill("Example Studio")
  await page.getByRole("button", { name: "Create workspace" }).click()
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible()
  await expect(page.getByText("No invoices yet")).toBeVisible()

  await page.getByRole("button", { name: "Log out" }).click()
  await expect(page).toHaveURL("/")

  await login(page, email, password)
  await page.getByRole("button", { name: "Log out" }).click()

  await page.goto("/forgot-password")
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Send reset link" }).click()
  await page.getByRole("link", { name: "Open reset link" }).click()
  await page.getByLabel("New password").fill(replacement)
  await page.getByRole("button", { name: "Update password" }).click()
  await expect(page).toHaveURL(/\/app/)
  await page.getByRole("button", { name: "Log out" }).click()

  await login(page, email, replacement)
  await page.getByRole("button", { name: "Log out" }).click()

  await page.goto("/magic")
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Email me a sign-in link" }).click()
  await page.getByRole("link", { name: "Open sign-in link" }).click()
  await expect(page).toHaveURL(/\/app/)
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible()
})
