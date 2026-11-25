import type { DiscountType, Invoice, InvoiceStatus, PricedInvoice } from "@/lib/domain/types"

export type LineInput = {
  quantity: number
  unitAmountCents: number
}

export type Discount =
  | { type: "none" }
  | { type: "percent"; bps: number }
  | { type: "fixed"; cents: number }

export type Totals = {
  subtotalCents: number
  discountCents: number
  taxableCents: number
  taxCents: number
  totalCents: number
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MoneyError"
  }
}

function assertFiniteNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new MoneyError(`${label} must be a non-negative finite number`)
  }
}

/** Quantity may be fractional. Half-up rounding to the nearest cent. */
export function lineTotalCents(line: LineInput): number {
  assertFiniteNonNegative(line.quantity, "Quantity")
  if (!Number.isInteger(line.unitAmountCents)) {
    throw new MoneyError("Unit amount must be integer cents")
  }
  assertFiniteNonNegative(line.unitAmountCents, "Unit amount")
  return Math.round(line.quantity * line.unitAmountCents)
}

export function computeTotals(input: {
  lines: LineInput[]
  discount: Discount
  taxRateBps: number
}): Totals {
  if (!Number.isInteger(input.taxRateBps) || input.taxRateBps < 0 || input.taxRateBps > 10000) {
    throw new MoneyError("Tax rate must be between 0 and 10000 basis points")
  }
  const subtotalCents = input.lines.reduce((sum, line) => sum + lineTotalCents(line), 0)
  let discountCents = 0
  if (input.discount.type === "percent") {
    if (
      !Number.isInteger(input.discount.bps) ||
      input.discount.bps < 0 ||
      input.discount.bps > 10000
    ) {
      throw new MoneyError("Percent discount must be between 0 and 10000 basis points")
    }
    discountCents = Math.round((subtotalCents * input.discount.bps) / 10000)
  } else if (input.discount.type === "fixed") {
    if (!Number.isInteger(input.discount.cents) || input.discount.cents < 0) {
      throw new MoneyError("Fixed discount must be integer cents")
    }
    discountCents = Math.min(input.discount.cents, subtotalCents)
  }
  const taxableCents = subtotalCents - discountCents
  const taxCents = Math.round((taxableCents * input.taxRateBps) / 10000)
  return {
    subtotalCents,
    discountCents,
    taxableCents,
    taxCents,
    totalCents: taxableCents + taxCents,
  }
}

export function toDiscount(invoice: {
  discountType: DiscountType
  discountValue: number
}): Discount {
  if (invoice.discountType === "percent") return { type: "percent", bps: invoice.discountValue }
  if (invoice.discountType === "fixed") return { type: "fixed", cents: invoice.discountValue }
  return { type: "none" }
}

export function effectiveStatus(
  status: InvoiceStatus,
  dueDate: string,
  today: string,
): InvoiceStatus {
  if (status === "draft" || status === "paid" || status === "void") return status
  if (dueDate < today) return "overdue"
  if (status === "overdue") return "sent"
  return status
}

export function priceInvoice(invoice: Invoice, today: string): PricedInvoice {
  const totals = computeTotals({
    lines: invoice.lines,
    discount: toDiscount(invoice),
    taxRateBps: invoice.taxRateBps,
  })
  return {
    ...invoice,
    ...totals,
    displayStatus: effectiveStatus(invoice.status, invoice.dueDate, today),
  }
}

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)
}

export function formatPercentFromBps(bps: number): string {
  return `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`
}

export function todayISO(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
