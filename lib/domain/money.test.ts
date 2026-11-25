import { describe, expect, it } from "vitest"
import { buildSeed } from "@/lib/data/seed"
import { WORKSPACE } from "@/lib/ids"
import { agingBucket, daysPastDue, summarize } from "@/lib/domain/metrics"
import {
  computeTotals,
  effectiveStatus,
  lineTotalCents,
  MoneyError,
  priceInvoice,
} from "@/lib/domain/money"
import { entitlements, hasPro } from "@/lib/domain/plans"
import type { Workspace } from "@/lib/domain/types"

describe("line totals", () => {
  it("rounds half up to the nearest cent", () => {
    expect(lineTotalCents({ quantity: 1.5, unitAmountCents: 1001 })).toBe(1502)
    expect(lineTotalCents({ quantity: 0.333, unitAmountCents: 1000 })).toBe(333)
    expect(lineTotalCents({ quantity: 3, unitAmountCents: 333 })).toBe(999)
  })

  it("rejects negative or non-integer cents", () => {
    expect(() => lineTotalCents({ quantity: -1, unitAmountCents: 100 })).toThrow(MoneyError)
    expect(() => lineTotalCents({ quantity: 1, unitAmountCents: 10.5 })).toThrow(MoneyError)
  })
})

describe("invoice totals", () => {
  it("applies percent discount before tax", () => {
    const totals = computeTotals({
      lines: [{ quantity: 1, unitAmountCents: 10000 }],
      discount: { type: "percent", bps: 1000 },
      taxRateBps: 825,
    })
    expect(totals.subtotalCents).toBe(10000)
    expect(totals.discountCents).toBe(1000)
    expect(totals.taxableCents).toBe(9000)
    expect(totals.taxCents).toBe(743)
    expect(totals.totalCents).toBe(9743)
  })

  it("rounds a percent discount half up", () => {
    const totals = computeTotals({
      lines: [{ quantity: 1, unitAmountCents: 1001 }],
      discount: { type: "percent", bps: 1000 },
      taxRateBps: 0,
    })
    expect(totals.discountCents).toBe(100)
    expect(totals.totalCents).toBe(901)
  })

  it("caps a fixed discount at the subtotal", () => {
    const totals = computeTotals({
      lines: [{ quantity: 2, unitAmountCents: 500 }],
      discount: { type: "fixed", cents: 5000 },
      taxRateBps: 1000,
    })
    expect(totals.discountCents).toBe(1000)
    expect(totals.taxCents).toBe(0)
    expect(totals.totalCents).toBe(0)
  })

  it("sums mixed quantities with no discount", () => {
    const totals = computeTotals({
      lines: [
        { quantity: 1, unitAmountCents: 180000 },
        { quantity: 1, unitAmountCents: 95000 },
        { quantity: 4, unitAmountCents: 12500 },
      ],
      discount: { type: "none" },
      taxRateBps: 0,
    })
    expect(totals.totalCents).toBe(325000)
  })

  it("rejects an out-of-range tax rate", () => {
    expect(() =>
      computeTotals({
        lines: [],
        discount: { type: "none" },
        taxRateBps: 10001,
      }),
    ).toThrow(MoneyError)
  })
})

describe("status and aging", () => {
  it("keeps drafts, paid, and void invoices stable", () => {
    expect(effectiveStatus("draft", "2020-01-01", "2026-11-25")).toBe("draft")
    expect(effectiveStatus("paid", "2020-01-01", "2026-11-25")).toBe("paid")
    expect(effectiveStatus("void", "2026-12-01", "2026-11-25")).toBe("void")
  })

  it("marks sent and viewed invoices overdue after the due date", () => {
    expect(effectiveStatus("sent", "2026-11-24", "2026-11-25")).toBe("overdue")
    expect(effectiveStatus("viewed", "2026-11-25", "2026-11-25")).toBe("viewed")
    expect(effectiveStatus("sent", "2026-11-26", "2026-11-25")).toBe("sent")
  })

  it("buckets aging from the due date", () => {
    expect(daysPastDue("2026-11-25", "2026-11-25")).toBe(0)
    expect(agingBucket(0)).toBe("current")
    expect(agingBucket(-3)).toBe("current")
    expect(agingBucket(1)).toBe("1-30")
    expect(agingBucket(30)).toBe("1-30")
    expect(agingBucket(31)).toBe("31-60")
    expect(agingBucket(90)).toBe("61-90")
    expect(agingBucket(91)).toBe("90+")
  })
})

describe("dashboard math", () => {
  it("separates outstanding, paid this month, and overdue", () => {
    const today = "2026-11-25"
    const seed = buildSeed(new Date("2026-11-25T15:00:00.000Z"))
    const priced = seed.invoices
      .filter((invoice) => invoice.workspaceId === WORKSPACE.northwind)
      .map((invoice) => priceInvoice(invoice, today))
    const summary = summarize(priced, today)
    expect(summary.overdueCount).toBe(2)
    expect(summary.paidThisMonthCents).toBeGreaterThan(0)
    expect(summary.outstandingCents).toBeGreaterThan(summary.paidThisMonthCents)
    expect(summary.revenue).toHaveLength(6)
    expect(summary.revenue.some((point) => point.totalCents > 0)).toBe(true)
    expect(summary.aging["90+"] + summary.aging["31-60"] + summary.aging["1-30"]).toBeGreaterThan(0)
  })
})

describe("plans", () => {
  const base: Workspace = {
    id: "ws",
    name: "Studio",
    slug: "studio",
    plan: "starter",
    subscriptionStatus: "trialing",
    trialEndsAt: "2026-12-01",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    invoicePrefix: "ST",
    nextNumber: 1,
    address: "",
    email: "billing@studio.example",
    createdAt: "2026-11-01T00:00:00.000Z",
  }

  it("treats an active trial as Pro", () => {
    expect(hasPro(base, "2026-11-25")).toBe(true)
    expect(entitlements(base, "2026-11-25").invoiceLimit).toBeNull()
    expect(entitlements(base, "2026-12-02").label).toBe("Starter")
  })

  it("drops Pro after a canceled period ends", () => {
    const workspace: Workspace = {
      ...base,
      plan: "pro",
      subscriptionStatus: "active",
      trialEndsAt: null,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: "2026-11-20",
    }
    expect(hasPro(workspace, "2026-11-25")).toBe(false)
    expect(hasPro(workspace, "2026-11-20")).toBe(true)
  })
})
