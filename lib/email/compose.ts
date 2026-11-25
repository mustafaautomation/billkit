import type { Client, PricedInvoice, Workspace } from "@/lib/domain/types"
import { formatMoney } from "@/lib/domain/money"

export function invoiceEmail(input: {
  workspace: Workspace
  client: Client
  invoice: PricedInvoice
  payUrl: string
  senderName: string
}) {
  return {
    subject: `Invoice ${input.invoice.number} from ${input.workspace.name}`,
    body: `Hi ${input.client.name.split(" ")[0]},

${input.workspace.name} sent invoice ${input.invoice.number} for ${formatMoney(input.invoice.totalCents)}.
It is due ${input.invoice.dueDate}.

Pay or download it here:
${input.payUrl}

${input.invoice.notes ? `${input.invoice.notes}\n\n` : ""}Thank you,
${input.senderName}
${input.workspace.name}`,
  }
}

export function viewedEmail(input: { workspace: Workspace; invoice: PricedInvoice; client: Client }) {
  return {
    subject: `${input.client.company || input.client.name} viewed ${input.invoice.number}`,
    body: `${input.client.name} opened invoice ${input.invoice.number} (${formatMoney(input.invoice.totalCents)}).

No payment has been recorded yet.`,
  }
}

export function overdueEmail(input: {
  workspace: Workspace
  client: Client
  invoice: PricedInvoice
  payUrl: string
  senderName: string
}) {
  return {
    subject: `Invoice ${input.invoice.number} is past due`,
    body: `Hi ${input.client.name.split(" ")[0]},

Invoice ${input.invoice.number} from ${input.workspace.name} for ${formatMoney(input.invoice.totalCents)} was due ${input.invoice.dueDate}.

The payment link is unchanged:
${input.payUrl}

If this is already on its way, please ignore the note.

Thank you,
${input.senderName}
${input.workspace.name}`,
  }
}

export function receiptEmail(input: {
  workspace: Workspace
  client: Client
  invoice: PricedInvoice
}) {
  return {
    subject: `Payment received for ${input.invoice.number}`,
    body: `Hi ${input.client.name.split(" ")[0]},

${input.workspace.name} marked invoice ${input.invoice.number} paid. Amount: ${formatMoney(input.invoice.totalCents)}.

Thank you.`,
  }
}

export function authEmail(input: { kind: "magic" | "reset"; link: string }) {
  const title = input.kind === "magic" ? "Your Billkit sign-in link" : "Reset your Billkit password"
  const line =
    input.kind === "magic"
      ? "Use this link to sign in. It expires in one hour."
      : "Use this link to choose a new password. It expires in one hour."
  return {
    subject: title,
    body: `${line}\n\n${input.link}\n\nIf you did not ask for this, you can ignore the message.`,
  }
}
