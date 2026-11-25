import type { Workspace } from "@/lib/domain/types"

export const TRIAL_DAYS = 14

export const PLANS = {
  starter: {
    id: "starter" as const,
    name: "Starter",
    monthlyCents: 1900,
    invoiceLimit: 25,
    seatLimit: 2,
    description: "For a solo practice that sends a few dozen invoices a month.",
    features: [
      "25 invoices each month",
      "2 seats",
      "Client payment page",
      "Overdue aging",
      "Billkit mark on PDFs",
    ],
  },
  pro: {
    id: "pro" as const,
    name: "Pro",
    monthlyCents: 4900,
    invoiceLimit: null,
    seatLimit: 25,
    description: "For studios and small firms that bill every week.",
    features: [
      "Unlimited invoices",
      "25 seats",
      "Reminder drafts",
      "Clean PDFs",
      "Priority webhook billing",
    ],
  },
}

export type Entitlements = {
  invoiceLimit: number | null
  seatLimit: number
  removeBranding: boolean
  label: string
  trialing: boolean
}

function dateOnly(value: string | null): string | null {
  return value ? value.slice(0, 10) : null
}

export function hasPro(
  workspace: Pick<
    Workspace,
    "plan" | "subscriptionStatus" | "trialEndsAt" | "cancelAtPeriodEnd" | "currentPeriodEnd"
  >,
  today: string,
): boolean {
  const trialEnd = dateOnly(workspace.trialEndsAt)
  const trialing =
    workspace.subscriptionStatus === "trialing" && !!trialEnd && trialEnd >= today
  if (trialing) return true
  if (workspace.plan !== "pro") return false
  if (workspace.subscriptionStatus !== "active" && workspace.subscriptionStatus !== "past_due") {
    return false
  }
  const periodEnd = dateOnly(workspace.currentPeriodEnd)
  if (workspace.cancelAtPeriodEnd && periodEnd && periodEnd < today) return false
  return true
}

export function entitlements(workspace: Workspace, today: string): Entitlements {
  const trialEnd = dateOnly(workspace.trialEndsAt)
  const trialing =
    workspace.subscriptionStatus === "trialing" && !!trialEnd && trialEnd >= today
  if (hasPro(workspace, today)) {
    return {
      invoiceLimit: null,
      seatLimit: PLANS.pro.seatLimit,
      removeBranding: true,
      label: trialing ? "Pro trial" : "Pro",
      trialing,
    }
  }
  return {
    invoiceLimit: PLANS.starter.invoiceLimit,
    seatLimit: PLANS.starter.seatLimit,
    removeBranding: false,
    label: "Starter",
    trialing: false,
  }
}

export function trialDaysLeft(workspace: Workspace, today: string): number | null {
  const trialEnd = dateOnly(workspace.trialEndsAt)
  if (workspace.subscriptionStatus !== "trialing" || !trialEnd || trialEnd < today) return null
  const end = Date.parse(`${trialEnd}T00:00:00Z`)
  const start = Date.parse(`${today}T00:00:00Z`)
  return Math.round((end - start) / 86_400_000)
}
