import "server-only"

import Stripe from "stripe"
import { env } from "@/lib/env"
import { PLANS } from "@/lib/domain/plans"

export function stripeClient() {
  const key = env("STRIPE_SECRET_KEY")
  if (!key) return null
  return new Stripe(key)
}

export async function subscriptionCheckout(input: {
  workspaceId: string
  plan: "starter" | "pro"
  customerId: string | null
  email: string
  origin: string
}) {
  const stripe = stripeClient()
  if (!stripe) return null
  const plan = PLANS[input.plan]
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: input.customerId ?? undefined,
    customer_email: input.customerId ? undefined : input.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: plan.monthlyCents,
          recurring: { interval: "month" },
          product_data: { name: `Billkit ${plan.name}` },
        },
      },
    ],
    success_url: `${input.origin}/app/settings/billing?checkout=success`,
    cancel_url: `${input.origin}/app/settings/billing?checkout=cancel`,
    metadata: { kind: "subscription", workspaceId: input.workspaceId, plan: input.plan },
    subscription_data: {
      metadata: { workspaceId: input.workspaceId, plan: input.plan },
    },
  })
  return session.url
}

export async function invoiceCheckout(input: {
  invoiceId: string
  publicToken: string
  number: string
  amountCents: number
  customerEmail: string
  origin: string
}) {
  const stripe = stripeClient()
  if (!stripe) return null
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.amountCents,
          product_data: { name: `Invoice ${input.number}` },
        },
      },
    ],
    success_url: `${input.origin}/pay/${input.publicToken}?result=paid`,
    cancel_url: `${input.origin}/pay/${input.publicToken}?result=cancel`,
    metadata: {
      kind: "invoice",
      invoiceId: input.invoiceId,
      publicToken: input.publicToken,
    },
  })
  return session.url
}

export async function cancelStripeSubscription(subscriptionId: string) {
  const stripe = stripeClient()
  if (!stripe) return false
  await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
  return true
}
