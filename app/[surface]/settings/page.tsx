import { notFound } from "next/navigation"
import { WorkspaceForm } from "@/components/settings-forms"
import { PageHeader } from "@/components/ui-bits"
import { getAppContext } from "@/lib/context"

export const metadata = { title: "Settings" }

export default async function SettingsPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params
  if (surface !== "app" && surface !== "demo") notFound()
  const context = await getAppContext(surface)
  const locked = context.readOnly || context.role !== "owner"
  return (
    <div>
      <PageHeader title="Workspace settings" description="Name, billing address, and the prefix on new invoice numbers." />
      <WorkspaceForm workspace={context.workspace} locked={locked} />
    </div>
  )
}
