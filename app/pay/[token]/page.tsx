import Link from "next/link"
import { notFound } from "next/navigation"
import { StatusBadge } from "@/components/status-badge"
import { ErrorNote } from "@/components/ui-bits"
import { Button } from "@/components/ui/button"
import { mockPayAction, payWithCardAction } from "@/lib/actions/app"
import { ActionError } from "@/lib/data/errors"
import { openPublicInvoice } from "@/lib/data/service"
import { formatMoney, formatPercentFromBps } from "@/lib/domain/money"
import { integrationMode } from "@/lib/env"
import { getOrigin } from "@/lib/origin"

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ result?: string; error?: string }>
}) {
  const { token } = await params
  const query = await searchParams
  const origin = await getOrigin()
  let opened: Awaited<ReturnType<typeof openPublicInvoice>>
  try {
    opened = await openPublicInvoice(token, origin)
  } catch (error) {
    if (error instanceof ActionError) notFound()
    throw error
  }
  const { invoice, client, workspace } = opened
  const mode = integrationMode()
  const payable = invoice.displayStatus !== "paid" && invoice.displayStatus !== "void"
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm text-muted-foreground">{workspace.name}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="font-heading text-4xl">{invoice.number}</h1>
        <StatusBadge status={invoice.displayStatus} />
      </div>
      <p className="mt-2 text-sm">Prepared for {client.company || client.name}.</p>
      {query.result === "paid" || invoice.displayStatus === "paid" ? (
        <p role="status" className="mt-4 rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-950">
          Payment recorded. {workspace.name} has the receipt.
        </p>
      ) : null}
      {query.result === "cancel" ? <p className="mt-4 text-sm text-muted-foreground">Checkout was canceled.</p> : null}
      {query.error ? <div className="mt-4"><ErrorNote>{query.error}</ErrorNote></div> : null}
      <table className="mt-6 w-full text-sm">
        <caption className="sr-only">Invoice lines</caption>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.id} className="border-b">
              <td className="py-2">{line.description}</td>
              <td className="py-2 text-right">{formatMoney(Math.round(line.quantity * line.unitAmountCents))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-4 grid gap-1 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(invoice.subtotalCents)}</dd></div>
        {invoice.discountCents > 0 ? <div className="flex justify-between"><dt>Discount</dt><dd>-{formatMoney(invoice.discountCents)}</dd></div> : null}
        {invoice.taxCents > 0 ? <div className="flex justify-between"><dt>Tax {formatPercentFromBps(invoice.taxRateBps)}</dt><dd>{formatMoney(invoice.taxCents)}</dd></div> : null}
        <div className="flex justify-between text-lg font-medium"><dt>Due {invoice.dueDate}</dt><dd>{formatMoney(invoice.totalCents)}</dd></div>
      </dl>
      {invoice.notes ? <p className="mt-4 text-sm text-muted-foreground">{invoice.notes}</p> : null}
      {payable ? (
        <section className="mt-6 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          {mode.payments === "stripe" ? (
            <form action={payWithCardAction}>
              <input type="hidden" name="token" value={token} />
              <Button type="submit" className="h-11">Pay with card</Button>
            </form>
          ) : (
            <form action={mockPayAction} className="grid gap-3">
              <input type="hidden" name="token" value={token} />
              <p className="text-sm">
                Mock checkout. No card is collected or charged. Stripe test card 4242 4242 4242 4242 is used only after live keys are set.
              </p>
              <Button type="submit" className="h-11 w-fit">Confirm test payment</Button>
            </form>
          )}
        </section>
      ) : null}
      <p className="mt-6 text-sm">
        <a className="underline-offset-4 hover:underline" href={`/api/invoices/${invoice.id}/pdf?token=${token}`}>Download PDF</a>
        <span className="mx-2 text-muted-foreground">·</span>
        <Link href="/" className="underline-offset-4 hover:underline">Billkit</Link>
      </p>
    </main>
  )
}
