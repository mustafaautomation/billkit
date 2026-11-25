import Link from "next/link"
import { notFound } from "next/navigation"
import { ClientForm } from "@/components/client-form"
import { StatusBadge } from "@/components/status-badge"
import { ErrorNote, PageHeader } from "@/components/ui-bits"
import { Button } from "@/components/ui/button"
import { deleteClientAction } from "@/lib/actions/app"
import { getAppContext } from "@/lib/context"
import { ActionError } from "@/lib/data/errors"
import { getScopedClient } from "@/lib/data/service"
import { formatMoney } from "@/lib/domain/money"

export const metadata = { title: "Client" }

export default async function ClientPage({
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
  let data: Awaited<ReturnType<typeof getScopedClient>>
  try {
    data = await getScopedClient(context.actor, id)
  } catch (caught) {
    if (caught instanceof ActionError && caught.code === "not_found") notFound()
    throw caught
  }
  const base = `/${context.surface}`
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <PageHeader title={data.client.company} description={data.client.name} />
        {error ? <div className="mb-4"><ErrorNote>{error === "readonly" ? "This is a read-only demo. Create a free workspace to make changes." : error}</ErrorNote></div> : null}
        <ClientForm surface={context.surface} client={data.client} />
        <form action={deleteClientAction} className="mt-4">
          <input type="hidden" name="surface" value={context.surface} />
          <input type="hidden" name="clientId" value={data.client.id} />
          <Button type="submit" variant="destructive" className="h-10">Delete client</Button>
        </form>
      </section>
      <section>
        <h2 className="font-heading text-2xl">Invoices</h2>
        <ul className="mt-3 divide-y rounded-xl bg-card ring-1 ring-foreground/10">
          {data.invoices.length === 0 ? <li className="p-4 text-sm text-muted-foreground">No invoices for this client yet.</li> : null}
          {data.invoices.map((invoice) => (
            <li key={invoice.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <Link href={`${base}/invoices/${invoice.id}`} className="font-medium underline-offset-4 hover:underline">{invoice.number}</Link>
              <StatusBadge status={invoice.displayStatus} />
              <span>{formatMoney(invoice.totalCents)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
