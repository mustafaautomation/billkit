import { connection } from "next/server"
import { AppShell } from "@/components/shell"
import { getAppContext } from "@/lib/context"
import { todayISO } from "@/lib/domain/money"
import { entitlements, trialDaysLeft } from "@/lib/domain/plans"

export default async function SurfaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ surface: string }>
}) {
  await connection()
  const { surface } = await params
  const context = await getAppContext(surface)
  const today = todayISO()
  const rights = entitlements(context.workspace, today)
  const base = `/${context.surface}`
  const items = [
    { href: base, label: "Overview" },
    { href: `${base}/invoices`, label: "Invoices" },
    { href: `${base}/clients`, label: "Clients" },
    { href: `${base}/inbox`, label: "Inbox" },
    { href: `${base}/notifications`, label: "Notifications" },
    { href: `${base}/settings`, label: "Settings" },
    { href: `${base}/settings/team`, label: "Team" },
    { href: `${base}/settings/billing`, label: "Billing" },
  ]
  if (context.user?.isSuperAdmin && context.surface === "app") {
    items.push({ href: "/app/admin", label: "Admin" })
  }
  return (
    <AppShell
      surface={context.surface}
      readOnly={context.readOnly}
      workspaceName={context.workspace.name}
      workspaceId={context.workspace.id}
      planLabel={rights.label}
      trialDays={context.readOnly ? null : trialDaysLeft(context.workspace, today)}
      user={
        context.user
          ? { name: context.user.name, email: context.user.email, isSuperAdmin: context.user.isSuperAdmin }
          : null
      }
      role={context.role}
      unread={context.unread}
      mode={context.mode}
      memberships={context.memberships.map((item) => ({ id: item.workspace.id, name: item.workspace.name }))}
      items={items}
    >
      {children}
    </AppShell>
  )
}
