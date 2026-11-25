import type { InvoiceStatus, PricedInvoice } from "@/lib/domain/types"

export type AgingKey = "current" | "1-30" | "31-60" | "61-90" | "90+"

export type RevenuePoint = {
  month: string
  label: string
  totalCents: number
}

export type DashboardSummary = {
  outstandingCents: number
  paidThisMonthCents: number
  overdueCount: number
  revenue: RevenuePoint[]
  aging: Record<AgingKey, number>
}

const OPEN: InvoiceStatus[] = ["sent", "viewed", "overdue"]

export function daysPastDue(dueDate: string, today: string): number {
  const due = Date.parse(`${dueDate}T00:00:00Z`)
  const now = Date.parse(`${today}T00:00:00Z`)
  return Math.round((now - due) / 86_400_000)
}

export function agingBucket(days: number): AgingKey {
  if (days <= 0) return "current"
  if (days <= 30) return "1-30"
  if (days <= 60) return "31-60"
  if (days <= 90) return "61-90"
  return "90+"
}

export function recentMonths(today: string, count = 6): string[] {
  const [year, month] = today.split("-").map(Number)
  const keys: string[] = []
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - index, 1))
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
    keys.push(key)
  }
  return keys
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  })
}

export function summarize(invoices: PricedInvoice[], today: string): DashboardSummary {
  const open = invoices.filter((invoice) => OPEN.includes(invoice.displayStatus))
  const month = today.slice(0, 7)
  const aging: Record<AgingKey, number> = {
    current: 0,
    "1-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  }
  for (const invoice of open) {
    aging[agingBucket(daysPastDue(invoice.dueDate, today))] += invoice.totalCents
  }
  return {
    outstandingCents: open.reduce((sum, invoice) => sum + invoice.totalCents, 0),
    paidThisMonthCents: invoices
      .filter(
        (invoice) =>
          invoice.displayStatus === "paid" && invoice.paidAt?.slice(0, 7) === month,
      )
      .reduce((sum, invoice) => sum + invoice.totalCents, 0),
    overdueCount: invoices.filter((invoice) => invoice.displayStatus === "overdue").length,
    revenue: recentMonths(today).map((key) => ({
      month: key,
      label: monthLabel(key),
      totalCents: invoices
        .filter(
          (invoice) =>
            invoice.displayStatus === "paid" && invoice.paidAt?.slice(0, 7) === key,
        )
        .reduce((sum, invoice) => sum + invoice.totalCents, 0),
    })),
    aging,
  }
}
