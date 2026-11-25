import { notFound } from "next/navigation"
import { ClientForm } from "@/components/client-form"
import { PageHeader } from "@/components/ui-bits"
import { getAppContext } from "@/lib/context"

export const metadata = { title: "New client" }

export default async function NewClientPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params
  if (surface !== "app" && surface !== "demo") notFound()
  const context = await getAppContext(surface)
  return (
    <div>
      <PageHeader title="New client" description="Use a fictional or client-approved address. Billkit's demo data stays on .example emails." />
      <ClientForm surface={context.surface} />
    </div>
  )
}
