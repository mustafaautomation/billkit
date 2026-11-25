import { stripeClient } from "@/lib/billing/stripe"
import { recordPayment, setSubscription } from "@/lib/data/service"
import { env } from "@/lib/env"
import type { PlanId, SubscriptionStatus } from "@/lib/domain/types"

type StripeObject = {
  metadata?: Record<string, string>
  amount_total?: number | null
  mode?: string
  customer?: string | { id?: string } | null
  subscription?: string | { id?: string } | null
  status?: string
  cancel_at_period_end?: boolean
  current_period_end?: number
}

function idOf(value: string | { id?: string } | null | undefined) {
  if (!value) return null
  return typeof value === "string" ? value : value.id ?? null
}

function mapStatus(status: string | undefined): SubscriptionStatus {
  if (status === "active") return "active"
  if (status === "trialing") return "trialing"
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return "past_due"
  if (status === "canceled" || status === "incomplete_expired") return "canceled"
  return "none"
}

export async function POST(request: Request) {
  const stripe = stripeClient()
  const secret = env("STRIPE_WEBHOOK_SECRET")
  if (!stripe || !secret) {
    return Response.json({ error: "Stripe is not configured" }, { status: 501 })
  }
  const signature = request.headers.get("stripe-signature")
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 })
  const body = await request.text()
  let event: { type: string; data: { object: StripeObject } }
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret) as typeof event
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 })
  }
  const object = event.data.object
  const metadata = object.metadata ?? {}
  if (event.type === "checkout.session.completed" && metadata.kind === "invoice" && metadata.publicToken) {
    await recordPayment(metadata.publicToken, object.amount_total ?? undefined)
  }
  if (event.type === "checkout.session.completed" && metadata.kind === "subscription" && metadata.workspaceId) {
    const plan: PlanId = metadata.plan === "starter" ? "starter" : "pro"
    await setSubscription(metadata.workspaceId, {
      plan,
      subscriptionStatus: "active",
      stripeCustomerId: idOf(object.customer),
      stripeSubscriptionId: idOf(object.subscription),
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      clearTrial: true,
    })
  }
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    if (metadata.workspaceId) {
      const plan: PlanId = metadata.plan === "starter" ? "starter" : "pro"
      const ended = event.type === "customer.subscription.deleted"
      await setSubscription(metadata.workspaceId, {
        plan: ended ? "starter" : plan,
        subscriptionStatus: ended ? "canceled" : mapStatus(object.status),
        cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
        currentPeriodEnd: object.current_period_end
          ? new Date(object.current_period_end * 1000).toISOString()
          : null,
        clearTrial: true,
      })
    }
  }
  return Response.json({ received: true })
}
