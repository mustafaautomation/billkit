import Link from "next/link"
import { notFound } from "next/navigation"
import { RevenueChart } from "@/components/revenue-chart"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState, PageHeader } from "@/components/ui-bits"
import { buttonVariants } from "@/components/ui/button"
import { getAppContext } from "@/lib/context"
import { loadDashboard } from "@/lib/data/service"
import { formatMoney } from "@/lib/domain/money"
import { getOrigin } from "@/lib/origin"
import { cn } from "@/lib/utils"

export const metadata = { title: "Overview" }

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ surface: string }>
}) {
  const { surface } = await params
  if (surface !== "app" && surface !== "demo") notFound()
  const context = await getAppContext(surface)
  const origin = await getOrigin()
  const data = await loadDashboard(context.actor, origin)
  const base = `/${context.surface}`
  const clientName = new Map(data.clients.map((client) => [client.id, client.company || client.name]))
  return (
    <div>
      <PageHeader
        eyebrow={data.workspace.name}
        title="Overview"
        description="Outstanding work, what landed this month, and how old the unpaid invoices are."
        action={
          <Link href={`${base}/invoices/new`} className={cn(buttonVariants(), "h-10")}>
            New invoice
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Outstanding" value={formatMoney(data.summary.outstandingCents)} hint="Sent, viewed, and overdue" />
        <Metric label="Paid this month" value={formatMoney(data.summary.paidThisMonthCents)} hint="Cash recorded this month" />
        <Metric label="Overdue" value={String(data.summary.overdueCount)} hint="Open past the due date" href={`${base}/invoices?status=overdue`} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-3">
          <h2 className="font-heading text-xl">Revenue</h2>
          <p className="text-sm text-muted-foreground">Paid invoices, last six months.</p>
          <RevenueChart data={data.summary.revenue} />
        </section>
        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2">
          <h2 className="font-heading text-xl">Aging</h2>
          <p className="mb-4 text-sm text-muted-foreground">Open balances by days past due.</p>
          <ul className="grid gap-3">
            {(
              [
                ["current", "Not yet due"],
                ["1-30", "1–30 days"],
                ["31-60", "31–60 days"],
                ["61-90", "61–90 days"],
                ["90+", "Over 90 days"],
              ] as const
            ).map(([key, label]) => {
              const amount = data.summary.aging[key]
              const width = data.summary.outstandingCents
                ? Math.max(4, Math.round((amount / data.summary.outstandingCents) * 100))
                : 0
              return (
                <li key={key}>
                  <div className="flex justify-between text-sm">
                    <span>{label}</span>
                    <span>{formatMoney(amount)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${amount ? width : 0}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
      <section className="mt-6">
        <h2 className="mb-3 font-heading text-2xl">Recent invoices</h2>
        {data.recent.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            body="Add a client, then send the first invoice. The ledger fills in from there."
            action={<Link href={`${base}/clients/new`} className={cn(buttonVariants(), "h-10")}>Add a client</Link>}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
            <table className="w-full text-sm">
              <caption className="sr-only">Recent invoices</caption>
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Number</th>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((invoice) => (
                  <tr key={invoice.id} className="border-t">
                    <td className="px-3 py-2">
                      <Link href={`${base}/invoices/${invoice.id}`} className="font-medium underline-offset-4 hover:underline">
                        {invoice.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{clientName.get(invoice.clientId)}</td>
                    <td className="px-3 py-2"><StatusBadge status={invoice.displayStatus} /></td>
                    <td className="px-3 py-2 text-right">{formatMoney(invoice.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value, hint, href }: { label: string; value: string; hint: string; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-3xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </>
  )
  const className = "rounded-xl bg-card p-4 ring-1 ring-foreground/10"
  if (!href) return <section className={className}>{body}</section>
  return (
    <Link href={href} className={`${className} block hover:bg-accent/40`}>
      {body}
    </Link>
  )
}
