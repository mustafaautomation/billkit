import { notFound } from "next/navigation"
import { PageHeader } from "@/components/ui-bits"
import { Button } from "@/components/ui/button"
import { adminPlanAction } from "@/lib/actions/app"
import { getAppContext } from "@/lib/context"
import { ActionError } from "@/lib/data/errors"
import { adminUsage } from "@/lib/data/service"
import { formatMoney } from "@/lib/domain/money"

export const metadata = { title: "Admin" }

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ surface: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { surface } = await params
  if (surface !== "app") notFound()
  const { error } = await searchParams
  const context = await getAppContext(surface)
  if (!context.user?.isSuperAdmin) notFound()
  let rows: Awaited<ReturnType<typeof adminUsage>>
  try {
    rows = await adminUsage(context.actor)
  } catch (caught) {
    if (caught instanceof ActionError) notFound()
    throw caught
  }
  return (
    <div>
      <PageHeader
        title="Tenants"
        description="Plans and usage across workspaces. Invoice line items stay inside each tenant."
      />
      {error ? <p role="alert" className="mb-4 text-sm text-destructive">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <caption className="sr-only">Tenants, plans, and usage</caption>
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Workspace</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Members</th>
              <th className="px-3 py-2 text-right font-medium">Invoices</th>
              <th className="px-3 py-2 text-right font-medium">Outstanding</th>
              <th className="px-3 py-2 text-right font-medium">Paid this month</th>
              <th className="px-3 py-2 font-medium">Set plan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.workspace.id} className="border-t">
                <td className="px-3 py-2">
                  <p className="font-medium">{row.workspace.name}</p>
                  <p className="text-xs text-muted-foreground">{row.workspace.slug}</p>
                </td>
                <td className="px-3 py-2">{row.label}</td>
                <td className="px-3 py-2 capitalize">{row.workspace.subscriptionStatus.replace("_", " ")}</td>
                <td className="px-3 py-2 text-right">{row.members}</td>
                <td className="px-3 py-2 text-right">{row.invoices}</td>
                <td className="px-3 py-2 text-right">{formatMoney(row.outstandingCents)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(row.paidThisMonthCents)}</td>
                <td className="px-3 py-2">
                  <form action={adminPlanAction} className="flex gap-1">
                    <input type="hidden" name="workspaceId" value={row.workspace.id} />
                    <Button type="submit" name="plan" value="starter" size="sm" variant="outline">Starter</Button>
                    <Button type="submit" name="plan" value="pro" size="sm">Pro</Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
