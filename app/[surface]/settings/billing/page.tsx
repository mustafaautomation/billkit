import { notFound } from "next/navigation"
import { BillingForms } from "@/components/settings-forms"
import { ErrorNote, PageHeader } from "@/components/ui-bits"
import { getAppContext } from "@/lib/context"
import { loadBilling } from "@/lib/data/service"

export const metadata = { title: "Billing" }

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ surface: string }>
  searchParams: Promise<{ error?: string; checkout?: string }>
}) {
  const { surface } = await params
  if (surface !== "app" && surface !== "demo") notFound()
  const query = await searchParams
  const context = await getAppContext(surface)
  const data = await loadBilling(context.actor)
  const limit = data.entitlements.invoiceLimit
  return (
    <div>
      <PageHeader
        title="Billing"
        description={`${data.entitlements.label}. ${data.used} invoice${data.used === 1 ? "" : "s"} created this month${limit ? ` of ${limit}` : ""}.`}
      />
      {query.error ? <div className="mb-4"><ErrorNote>{query.error}</ErrorNote></div> : null}
      {query.checkout === "success" ? <p role="status" className="mb-4 text-sm">Checkout returned. The webhook will confirm the subscription.</p> : null}
      {query.checkout === "cancel" ? <p className="mb-4 text-sm text-muted-foreground">Checkout was canceled. The plan is unchanged.</p> : null}
      <dl className="mb-6 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <dt className="text-muted-foreground">Status</dt>
          <dd className="capitalize">{data.workspace.subscriptionStatus.replace("_", " ")}</dd>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <dt className="text-muted-foreground">Renews or ends</dt>
          <dd>{data.workspace.currentPeriodEnd?.slice(0, 10) ?? data.workspace.trialEndsAt ?? "—"}</dd>
          {data.workspace.cancelAtPeriodEnd ? <p className="text-xs text-muted-foreground">Cancels at period end.</p> : null}
        </div>
      </dl>
      {context.readOnly ? (
        <p className="text-sm text-muted-foreground">Plan changes are disabled in the demo.</p>
      ) : (
        <BillingForms payments={context.mode.payments} canManage={context.role === "owner"} />
      )}
    </div>
  )
}
