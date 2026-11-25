"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { isRedirectError } from "next/dist/client/components/redirect-error"
import { setWorkspaceCookie } from "@/lib/auth/session"
import { cancelStripeSubscription, invoiceCheckout, subscriptionCheckout } from "@/lib/billing/stripe"
import { getAppContext } from "@/lib/context"
import { ActionError } from "@/lib/data/errors"
import {
  adminSetPlan,
  createOrUpdateInvoice,
  draftReminder,
  inviteMember,
  mockCancel,
  mockChangePlan,
  readNotifications,
  recordPayment,
  removeClient,
  removeMember,
  saveClient,
  sendInvoice,
  sendReminder,
  updateWorkspaceProfile,
  voidInvoice,
  type InvoiceDraft,
} from "@/lib/data/service"
import { env, integrationMode } from "@/lib/env"
import { getOrigin } from "@/lib/origin"
import type { DiscountType, PlanId } from "@/lib/domain/types"

export type FormState = {
  error: string
  text?: string
  source?: string
  note?: string
  mockLink?: string
}

function failure(error: unknown): FormState {
  if (isRedirectError(error)) throw error
  if (error instanceof ActionError) return { error: error.message }
  if (error instanceof Error) return { error: error.message }
  return { error: "Something went wrong. Try again." }
}

async function actorFor(surface: string) {
  const context = await getAppContext(surface === "demo" ? "demo" : "app")
  return context
}

function refresh() {
  revalidatePath("/app", "layout")
  revalidatePath("/demo", "layout")
}

export async function rejectDemoAction(): Promise<FormState> {
  return {
    error: "This is a read-only demo. Create a free workspace to make changes.",
  }
}

function parseLines(raw: string): InvoiceDraft["lines"] {
  const parsed = JSON.parse(raw) as Array<{ description?: string; quantity?: number; rate?: string }>
  if (!Array.isArray(parsed)) throw new ActionError("Check the line items.")
  return parsed.map((line) => {
    const rate = Number(String(line.rate ?? "").replace(/[^0-9.]/g, ""))
    return {
      description: String(line.description ?? ""),
      quantity: Number(line.quantity),
      unitAmountCents: Number.isFinite(rate) ? Math.round(rate * 100) : -1,
    }
  })
}

function parseDraft(formData: FormData): InvoiceDraft {
  const discountType = String(formData.get("discountType") ?? "none") as DiscountType
  const discountRaw = Number(formData.get("discountValue") ?? 0)
  let discountValue = 0
  if (discountType === "percent") discountValue = Math.round(discountRaw * 100)
  if (discountType === "fixed") discountValue = Math.round(discountRaw * 100)
  return {
    clientId: String(formData.get("clientId") ?? ""),
    issueDate: String(formData.get("issueDate") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    taxPercent: Number(formData.get("taxPercent") ?? 0),
    discountType: discountType === "percent" || discountType === "fixed" ? discountType : "none",
    discountValue,
    notes: String(formData.get("notes") ?? ""),
    lines: parseLines(String(formData.get("lines") ?? "[]")),
  }
}

export async function saveInvoiceAction(_state: FormState, formData: FormData): Promise<FormState> {
  const surface = String(formData.get("surface") ?? "app")
  try {
    const context = await actorFor(surface)
    if (context.readOnly) return await rejectDemoAction()
    const draft = parseDraft(formData)
    const existing = String(formData.get("invoiceId") ?? "")
    const invoice = await createOrUpdateInvoice(context.actor, draft, existing || undefined)
    if (String(formData.get("intent") ?? "") === "send") {
      await sendInvoice(context.actor, invoice.id, await getOrigin())
    }
    refresh()
    redirect(`/${context.surface}/invoices/${invoice.id}`)
  } catch (error) {
    return failure(error)
  }
}

export async function sendInvoiceAction(formData: FormData) {
  const surface = String(formData.get("surface") ?? "app")
  const id = String(formData.get("invoiceId") ?? "")
  try {
    const context = await actorFor(surface)
    if (context.readOnly) redirect(`/${surface}/invoices/${id}?error=readonly`)
    await sendInvoice(context.actor, id, await getOrigin())
    refresh()
  } catch (error) {
    if (error instanceof ActionError) redirect(`/${surface}/invoices/${id}?error=${encodeURIComponent(error.message)}`)
    throw error
  }
  redirect(`/${surface}/invoices/${id}`)
}

export async function voidInvoiceAction(formData: FormData) {
  const surface = String(formData.get("surface") ?? "app")
  const id = String(formData.get("invoiceId") ?? "")
  try {
    const context = await actorFor(surface)
    if (context.readOnly) redirect(`/${surface}/invoices/${id}?error=readonly`)
    await voidInvoice(context.actor, id)
    refresh()
  } catch (error) {
    if (error instanceof ActionError) redirect(`/${surface}/invoices/${id}?error=${encodeURIComponent(error.message)}`)
    throw error
  }
  redirect(`/${surface}/invoices/${id}`)
}

export async function reminderAction(_state: FormState, formData: FormData): Promise<FormState> {
  try {
    const context = await actorFor(String(formData.get("surface") ?? "app"))
    if (context.readOnly) return await rejectDemoAction()
    const draft = await draftReminder(context.actor, String(formData.get("invoiceId") ?? ""), await getOrigin())
    return { error: "", text: draft.text, source: draft.source, note: draft.note }
  } catch (error) {
    return failure(error)
  }
}

export async function sendReminderAction(_state: FormState, formData: FormData): Promise<FormState> {
  const surface = String(formData.get("surface") ?? "app")
  const id = String(formData.get("invoiceId") ?? "")
  try {
    const context = await actorFor(surface)
    if (context.readOnly) return await rejectDemoAction()
    await sendReminder(context.actor, id, String(formData.get("body") ?? ""), await getOrigin())
    refresh()
  } catch (error) {
    return failure(error)
  }
  redirect(`/${surface}/invoices/${id}`)
}

export async function saveClientAction(_state: FormState, formData: FormData): Promise<FormState> {
  const surface = String(formData.get("surface") ?? "app")
  try {
    const context = await actorFor(surface)
    if (context.readOnly) return await rejectDemoAction()
    const client = await saveClient(context.actor, {
      id: String(formData.get("clientId") ?? "") || undefined,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      company: String(formData.get("company") ?? ""),
      address: String(formData.get("address") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    })
    refresh()
    redirect(`/${context.surface}/clients/${client.id}`)
  } catch (error) {
    return failure(error)
  }
}

export async function deleteClientAction(formData: FormData) {
  const surface = String(formData.get("surface") ?? "app")
  const id = String(formData.get("clientId") ?? "")
  try {
    const context = await actorFor(surface)
    if (context.readOnly) redirect(`/${surface}/clients/${id}?error=readonly`)
    await removeClient(context.actor, id)
    refresh()
  } catch (error) {
    if (error instanceof ActionError) redirect(`/${surface}/clients/${id}?error=${encodeURIComponent(error.message)}`)
    throw error
  }
  redirect(`/${surface}/clients`)
}

export async function saveWorkspaceAction(_state: FormState, formData: FormData): Promise<FormState> {
  try {
    const context = await actorFor("app")
    await updateWorkspaceProfile(context.actor, {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      address: String(formData.get("address") ?? ""),
      invoicePrefix: String(formData.get("prefix") ?? ""),
    })
    refresh()
  } catch (error) {
    return failure(error)
  }
  redirect("/app/settings")
}

export async function inviteAction(_state: FormState, formData: FormData): Promise<FormState> {
  try {
    const context = await actorFor("app")
    const result = await inviteMember(context.actor, String(formData.get("email") ?? ""), await getOrigin())
    refresh()
    return { error: "", mockLink: result.pending ? result.mockLink : undefined, text: result.pending ? "Invite emailed." : "Member added." }
  } catch (error) {
    return failure(error)
  }
}

export async function removeMemberAction(formData: FormData) {
  try {
    const context = await actorFor("app")
    await removeMember(context.actor, String(formData.get("membershipId") ?? ""))
    refresh()
  } catch (error) {
    if (error instanceof ActionError) redirect(`/app/settings/team?error=${encodeURIComponent(error.message)}`)
    throw error
  }
  redirect("/app/settings/team")
}

export async function switchWorkspaceAction(formData: FormData) {
  await setWorkspaceCookie(String(formData.get("workspaceId") ?? ""))
  redirect("/app")
}

export async function markNotificationsAction() {
  const context = await actorFor("app")
  if (!context.readOnly) await readNotifications(context.actor)
  refresh()
  redirect("/app/notifications")
}

export async function billingAction(formData: FormData) {
  const intent = String(formData.get("intent") ?? "")
  const plan = (String(formData.get("plan") ?? "pro") === "starter" ? "starter" : "pro") as PlanId
  const context = await actorFor("app")
  const origin = await getOrigin()
  try {
    if (intent === "cancel") {
      if (context.workspace.stripeSubscriptionId && env("STRIPE_SECRET_KEY")) {
        await cancelStripeSubscription(context.workspace.stripeSubscriptionId)
      }
      await mockCancel(context.actor)
    } else if (integrationMode().payments === "stripe") {
      const url = await subscriptionCheckout({
        workspaceId: context.workspace.id,
        plan,
        customerId: context.workspace.stripeCustomerId,
        email: context.workspace.email,
        origin,
      })
      if (url) redirect(url)
      await mockChangePlan(context.actor, plan)
    } else {
      await mockChangePlan(context.actor, plan)
    }
    refresh()
  } catch (error) {
    if (isRedirectError(error)) throw error
    const message = error instanceof Error ? error.message : "Billing update failed."
    redirect(`/app/settings/billing?error=${encodeURIComponent(message)}`)
  }
  redirect("/app/settings/billing")
}

export async function adminPlanAction(formData: FormData) {
  const context = await actorFor("app")
  const plan = (String(formData.get("plan") ?? "starter") === "pro" ? "pro" : "starter") as PlanId
  try {
    await adminSetPlan(context.actor, String(formData.get("workspaceId") ?? ""), plan)
    refresh()
  } catch (error) {
    if (error instanceof ActionError) redirect(`/app/admin?error=${encodeURIComponent(error.message)}`)
    throw error
  }
  redirect("/app/admin")
}

export async function startInvoiceCheckout(token: string) {
  const origin = await getOrigin()
  const { openPublicInvoice } = await import("@/lib/data/service")
  const opened = await openPublicInvoice(token, origin)
  if (integrationMode().payments !== "stripe") return null
  return invoiceCheckout({
    invoiceId: opened.invoice.id,
    publicToken: token,
    number: opened.invoice.number,
    amountCents: opened.invoice.totalCents,
    customerEmail: opened.client.email,
    origin,
  })
}

export async function payWithCardAction(formData: FormData) {
  const token = String(formData.get("token") ?? "")
  try {
    const url = await startInvoiceCheckout(token)
    if (!url) redirect(`/pay/${token}`)
    redirect(url)
  } catch (error) {
    if (isRedirectError(error)) throw error
    const message = error instanceof Error ? error.message : "Checkout failed."
    redirect(`/pay/${token}?error=${encodeURIComponent(message)}`)
  }
}

export async function mockPayAction(formData: FormData) {
  const token = String(formData.get("token") ?? "")
  try {
    await recordPayment(token)
    refresh()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment failed."
    redirect(`/pay/${token}?error=${encodeURIComponent(message)}`)
  }
  redirect(`/pay/${token}?result=paid`)
}
