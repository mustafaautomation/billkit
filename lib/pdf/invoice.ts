import "server-only"

import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import type { Client, PricedInvoice, Workspace } from "@/lib/domain/types"
import { formatMoney, formatPercentFromBps } from "@/lib/domain/money"

export async function renderInvoicePdf(input: {
  workspace: Workspace
  client: Client
  invoice: PricedInvoice
  branded: boolean
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  let page = doc.addPage([612, 792])
  const ink = rgb(0.12, 0.22, 0.18)
  const muted = rgb(0.35, 0.4, 0.37)
  const forest = rgb(0.16, 0.38, 0.28)
  let y = 740

  const draw = (text: string, x: number, size: number, weight: "regular" | "bold" = "regular", color = ink) => {
    page.drawText(text, { x, y, size, font: weight === "bold" ? bold : font, color })
  }

  page.drawRectangle({ x: 0, y: 760, width: 612, height: 32, color: forest })
  page.drawText(input.workspace.name, {
    x: 48,
    y: 772,
    size: 12,
    font: bold,
    color: rgb(0.96, 0.94, 0.88),
  })
  y = 730
  draw("INVOICE", 48, 22, "bold")
  draw(input.invoice.number, 160, 22, "bold")
  draw(input.invoice.displayStatus.toUpperCase(), 430, 12, "bold", forest)
  y = 700
  draw(`Issued ${input.invoice.issueDate}`, 48, 10, "regular", muted)
  draw(`Due ${input.invoice.dueDate}`, 180, 10, "regular", muted)
  y = 670
  draw("From", 48, 9, "bold", muted)
  draw("Bill to", 320, 9, "bold", muted)
  y = 654
  for (const line of input.workspace.address.split("\n")) {
    draw(line, 48, 10)
    y -= 14
  }
  draw(input.workspace.email, 48, 10, "regular", muted)
  let billY = 654
  const bill = (text: string) => {
    page.drawText(text, { x: 320, y: billY, size: 10, font, color: ink })
    billY -= 14
  }
  bill(input.client.company || input.client.name)
  if (input.client.company) bill(input.client.name)
  for (const line of input.client.address.split("\n").filter(Boolean)) bill(line)
  bill(input.client.email)
  y = Math.min(y, billY) - 20

  page.drawRectangle({ x: 48, y: y - 6, width: 516, height: 22, color: rgb(0.94, 0.95, 0.93) })
  page.drawText("Description", { x: 56, y: y, size: 9, font: bold, color: muted })
  page.drawText("Qty", { x: 360, y: y, size: 9, font: bold, color: muted })
  page.drawText("Rate", { x: 410, y: y, size: 9, font: bold, color: muted })
  page.drawText("Amount", { x: 490, y: y, size: 9, font: bold, color: muted })
  y -= 28

  for (const item of input.invoice.lines) {
    if (y < 120) {
      page = doc.addPage([612, 792])
      y = 740
    }
    const amount = Math.round(item.quantity * item.unitAmountCents)
    page.drawText(item.description.slice(0, 64), { x: 56, y, size: 10, font, color: ink })
    page.drawText(String(item.quantity), { x: 360, y, size: 10, font, color: ink })
    page.drawText(formatMoney(item.unitAmountCents), { x: 410, y, size: 10, font, color: ink })
    page.drawText(formatMoney(amount), { x: 490, y, size: 10, font, color: ink })
    y -= 20
  }

  y -= 10
  const row = (label: string, value: string, strong = false) => {
    page.drawText(label, { x: 360, y, size: 10, font: strong ? bold : font, color: muted })
    page.drawText(value, { x: 470, y, size: 10, font: strong ? bold : font, color: ink })
    y -= 16
  }
  row("Subtotal", formatMoney(input.invoice.subtotalCents))
  if (input.invoice.discountCents > 0) row("Discount", `-${formatMoney(input.invoice.discountCents)}`)
  if (input.invoice.taxCents > 0) {
    row(`Tax ${formatPercentFromBps(input.invoice.taxRateBps)}`, formatMoney(input.invoice.taxCents))
  }
  row("Total", formatMoney(input.invoice.totalCents), true)

  if (input.invoice.notes) {
    y -= 16
    page.drawText("Notes", { x: 48, y, size: 9, font: bold, color: muted })
    y -= 16
    for (const part of input.invoice.notes.slice(0, 400).split("\n")) {
      page.drawText(part.slice(0, 90), { x: 48, y, size: 10, font, color: ink })
      y -= 14
    }
  }

  if (input.branded) {
    page.drawText("Prepared with Billkit", {
      x: 48,
      y: 36,
      size: 9,
      font,
      color: muted,
    })
  }

  return doc.save()
}
