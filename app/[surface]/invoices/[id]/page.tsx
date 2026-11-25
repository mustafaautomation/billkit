import { notFound } from "next/navigation"
import { InvoiceForm } from "@/components/invoice-form"
import { ReminderPanel } from "@/components/reminder-panel"
import { StatusBadge } from "@/components/status-badge"
import { ErrorNote, PageHeader } from "@/components/ui-bits"
import { Button, buttonVariants } from "@/components/ui/button"
import { sendInvoiceAction, voidInvoiceAction } from "@/lib/actions/app"
import { getAppContext } from "@/lib/context"
import { ActionError } from "@/lib/data/errors"
import { getScopedInvoice, listWorkspaceClients } from "@/lib/data/service"
import { formatMoney, formatPercentFromBps } from "@/lib/domain/money"
import { getOrigin } from "@/lib/origin"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `Invoice ${id.slice(0, 8)}` }
}

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ surface: string; id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { surface, id } = await params
  if (surface !== "app" && surface !== "demo") notFound()
  const { error } = await searchParams
  const context = await getAppContext(surface)
  let data: Awaited<ReturnType<typeof getScopedInvoice>>
  try {
    data = await getScopedInvoice(context.actor, id)
  } catch (caught) {
    if (caught instanceof ActionError && caught.code === "not_found") notFound()
    throw caught
  }
  const clients = data.invoice.status === "draft" ? (await listWorkspaceClients(context.actor, "")).clients : []
  const origin = await getOrigin()
  const payUrl = `${origin}/pay/${data.invoice.publicToken}`
  const open = ["sent", "viewed", "overdue"].includes(data.invoice.displayStatus)
  const message = error === "readonly" ? "This is a read-only demo. Create a free workspace to make changes." : error
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <article className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <PageHeader
          eyebrow={data.workspace.name}
          title={data.invoice.number}
          description={`${data.client.company} · ${data.client.name}`}
          action={<StatusBadge status={data.invoice.displayStatus} />}
        />
        {message ? <div className="mb-4"><ErrorNote>{message}</ErrorNote></div> : null}
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Issued</dt><dd>{data.invoice.issueDate}</dd></div>
          <div><dt className="text-muted-foreground">Due</dt><dd>{data.invoice.dueDate}</dd></div>
          <div><dt className="text-muted-foreground">Email</dt><dd>{data.client.email}</dd></div>
          <div><dt className="text-muted-foreground">Address</dt><dd className="whitespace-pre-line">{data.client.address || "—"}</dd></div>
        </dl>
        <table className="mt-6 w-full text-sm">
          <caption className="sr-only">Line items</caption>
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.invoice.lines.map((line) => (
              <tr key={line.id} className="border-t">
                <td className="py-2">{line.description}</td>
                <td className="py-2">{line.quantity}</td>
                <td className="py-2 text-right">{formatMoney(Math.round(line.quantity * line.unitAmountCents))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-4 grid gap-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(data.invoice.subtotalCents)}</dd></div>
          {data.invoice.discountCents > 0 ? (
            <div className="flex justify-between"><dt>Discount</dt><dd>-{formatMoney(data.invoice.discountCents)}</dd></div>
          ) : null}
          {data.invoice.taxCents > 0 ? (
            <div className="flex justify-between"><dt>Tax {formatPercentFromBps(data.invoice.taxRateBps)}</dt><dd>{formatMoney(data.invoice.taxCents)}</dd></div>
          ) : null}
          <div className="flex justify-between text-base font-medium"><dt>Total</dt><dd>{formatMoney(data.invoice.totalCents)}</dd></div>
        </dl>
        {data.invoice.notes ? <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">{data.invoice.notes}</p> : null}
      </article>
      <aside className="grid content-start gap-4">
        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="font-heading text-xl">Actions</h2>
          <div className="mt-3 grid gap-2">
            <a className={cn(buttonVariants({ variant: "outline" }), "h-10")} href={`/api/invoices/${data.invoice.id}/pdf?token=${data.invoice.publicToken}`}>
              Download PDF
            </a>
            {data.invoice.displayStatus !== "draft" ? (
              <a className={cn(buttonVariants({ variant: "outline" }), "h-10")} href={payUrl}>
                Open payment page
              </a>
            ) : null}
            {data.invoice.status === "draft" ? (
              <form action={sendInvoiceAction}>
                <input type="hidden" name="surface" value={context.surface} />
                <input type="hidden" name="invoiceId" value={data.invoice.id} />
                <Button type="submit" className="h-10 w-full">Send invoice</Button>
              </form>
            ) : null}
            {data.invoice.displayStatus !== "paid" && data.invoice.displayStatus !== "void" ? (
              <form action={voidInvoiceAction}>
                <input type="hidden" name="surface" value={context.surface} />
                <input type="hidden" name="invoiceId" value={data.invoice.id} />
                <Button type="submit" variant="destructive" className="h-10 w-full">Void invoice</Button>
              </form>
            ) : null}
          </div>
        </section>
        {data.invoice.status === "draft" ? (
          <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="mb-3 font-heading text-xl">Edit draft</h2>
            <InvoiceForm surface={context.surface} clients={clients} invoice={data.invoice} />
          </section>
        ) : null}
        {open ? (
          <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="mb-3 font-heading text-xl">Reminder</h2>
            <ReminderPanel surface={context.surface} invoiceId={data.invoice.id} />
          </section>
        ) : null}
      </aside>
    </div>
  )
}
