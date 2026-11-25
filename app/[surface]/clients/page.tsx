import Link from "next/link"
import { notFound } from "next/navigation"
import { controlClass, PageHeader } from "@/components/ui-bits"
import { buttonVariants } from "@/components/ui/button"
import { getAppContext } from "@/lib/context"
import { listWorkspaceClients } from "@/lib/data/service"
import { cn } from "@/lib/utils"

export const metadata = { title: "Clients" }

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ surface: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { surface } = await params
  if (surface !== "app" && surface !== "demo") notFound()
  const { q = "" } = await searchParams
  const context = await getAppContext(surface)
  const data = await listWorkspaceClients(context.actor, q)
  const base = `/${context.surface}`
  return (
    <div>
      <PageHeader
        title="Clients"
        description="The people and companies this workspace bills."
        action={<Link href={`${base}/clients/new`} className={cn(buttonVariants(), "h-10")}>New client</Link>}
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div className="grid min-w-64 flex-1 gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">Search clients</label>
          <input id="q" name="q" defaultValue={q} className={controlClass} placeholder="Name, company, or email" />
        </div>
        <button className={cn(buttonVariants(), "h-10")} type="submit">Filter</button>
      </form>
      {data.clients.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {q ? "No clients match that search." : "No clients yet. Add the first one before you invoice."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <caption className="sr-only">Clients</caption>
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 text-right font-medium">Invoices</th>
              </tr>
            </thead>
            <tbody>
              {data.clients.map((client) => (
                <tr key={client.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link href={`${base}/clients/${client.id}`} className="font-medium underline-offset-4 hover:underline">
                      {client.company}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{client.name}</td>
                  <td className="px-3 py-2">{client.email}</td>
                  <td className="px-3 py-2 text-right">{data.counts.get(client.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
