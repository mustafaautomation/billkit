import Link from "next/link"
import { notFound } from "next/navigation"
import { StatusBadge } from "@/components/status-badge"
import { controlClass, PageHeader } from "@/components/ui-bits"
import { buttonVariants } from "@/components/ui/button"
import { getAppContext } from "@/lib/context"
import { listWorkspaceInvoices } from "@/lib/data/service"
import { formatMoney } from "@/lib/domain/money"
import { getOrigin } from "@/lib/origin"
import { cn } from "@/lib/utils"

export const metadata = { title: "Invoices" }

export default async function InvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ surface: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { surface } = await params
  if (surface !== "app" && surface !== "demo") notFound()
  const query = await searchParams
  const pick = (key: string) => {
    const value = query[key]
    return Array.isArray(value) ? value[0] : value
  }
  const context = await getAppContext(surface)
  const data = await listWorkspaceInvoices(context.actor, await getOrigin(), {
    status: pick("status"),
    clientId: pick("client"),
    q: pick("q"),
    from: pick("from"),
    to: pick("to"),
  })
  const base = `/${context.surface}`
  const names = new Map(data.clients.map((client) => [client.id, client.company || client.name]))
  return (
    <div>
      <PageHeader
        title="Invoices"
        description={`${data.invoices.length} invoice${data.invoices.length === 1 ? "" : "s"} in this view.`}
        action={<Link href={`${base}/invoices/new`} className={cn(buttonVariants(), "h-10")}>New invoice</Link>}
      />
      <form method="get" className="mb-4 grid gap-3 md:grid-cols-6">
        <div className="grid gap-1.5 md:col-span-2">
          <label htmlFor="q" className="text-sm font-medium">Search invoices</label>
          <input id="q" name="q" defaultValue={pick("q") ?? ""} className={controlClass} placeholder="Number or client" />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="status" className="text-sm font-medium">Status</label>
          <select id="status" name="status" defaultValue={pick("status") ?? "any"} className={controlClass}>
            {["any", "draft", "sent", "viewed", "paid", "overdue", "void"].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="client" className="text-sm font-medium">Client</label>
          <select id="client" name="client" defaultValue={pick("client") ?? ""} className={controlClass}>
            <option value="">Any client</option>
            {data.clients.map((client) => (
              <option key={client.id} value={client.id}>{client.company}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="from" className="text-sm font-medium">From</label>
          <input id="from" name="from" type="date" defaultValue={pick("from") ?? ""} className={controlClass} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="to" className="text-sm font-medium">To</label>
          <input id="to" name="to" type="date" defaultValue={pick("to") ?? ""} className={controlClass} />
        </div>
        <div className="flex items-end gap-2 md:col-span-6">
          <button type="submit" className={cn(buttonVariants(), "h-10")}>Filter</button>
          <Link href={`${base}/invoices`} className={cn(buttonVariants({ variant: "outline" }), "h-10")}>Clear</Link>
        </div>
      </form>
      {data.invoices.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No invoices match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <caption className="sr-only">Invoices</caption>
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Number</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Issued</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link href={`${base}/invoices/${invoice.id}`} className="font-medium underline-offset-4 hover:underline">
                      {invoice.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{names.get(invoice.clientId)}</td>
                  <td className="px-3 py-2">{invoice.issueDate}</td>
                  <td className="px-3 py-2">{invoice.dueDate}</td>
                  <td className="px-3 py-2"><StatusBadge status={invoice.displayStatus} /></td>
                  <td className="px-3 py-2 text-right">{formatMoney(invoice.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
