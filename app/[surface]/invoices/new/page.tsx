import Link from "next/link"
import { notFound } from "next/navigation"
import { InvoiceForm } from "@/components/invoice-form"
import { EmptyState, PageHeader } from "@/components/ui-bits"
import { buttonVariants } from "@/components/ui/button"
import { getAppContext } from "@/lib/context"
import { listWorkspaceClients } from "@/lib/data/service"
import { addDays, todayISO } from "@/lib/domain/money"
import { cn } from "@/lib/utils"

export const metadata = { title: "New invoice" }

export default async function NewInvoicePage({
  params,
}: {
  params: Promise<{ surface: string }>
}) {
  const { surface } = await params
  if (surface !== "app" && surface !== "demo") notFound()
  const context = await getAppContext(surface)
  const { clients } = await listWorkspaceClients(context.actor, "")
  return (
    <div>
      <PageHeader title="New invoice" description="Save a draft, or send it and email the client in one step." />
      {clients.length === 0 ? (
        <EmptyState
          title="Add a client first"
          body="An invoice needs someone to bill."
          action={<Link href={`/${context.surface}/clients/new`} className={cn(buttonVariants(), "h-10")}>New client</Link>}
        />
      ) : (
        <InvoiceForm
          surface={context.surface}
          clients={clients}
          issueDate={todayISO()}
          dueDate={addDays(todayISO(), 14)}
        />
      )}
    </div>
  )
}
