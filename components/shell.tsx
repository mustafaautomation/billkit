"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu } from "lucide-react"
import { logoutAction } from "@/lib/actions/auth"
import { switchWorkspaceAction } from "@/lib/actions/app"
import { Mark } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import type { IntegrationMode } from "@/lib/env"
import { cn } from "@/lib/utils"

type Item = { href: string; label: string }

export function AppShell({
  surface,
  readOnly,
  workspaceName,
  workspaceId,
  planLabel,
  trialDays,
  user,
  role,
  unread,
  mode,
  memberships,
  items,
  children,
}: {
  surface: "app" | "demo"
  readOnly: boolean
  workspaceName: string
  workspaceId: string
  planLabel: string
  trialDays: number | null
  user: { name: string; email: string; isSuperAdmin: boolean } | null
  role: string
  unread: number
  mode: IntegrationMode
  memberships: { id: string; name: string }[]
  items: Item[]
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[240px_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <aside className="hidden border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <Sidebar
          surface={surface}
          workspaceName={workspaceName}
          workspaceId={workspaceId}
          planLabel={planLabel}
          user={user}
          role={role}
          unread={unread}
          mode={mode}
          memberships={memberships}
          items={items}
        />
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <MobileNav
              surface={surface}
              workspaceName={workspaceName}
              workspaceId={workspaceId}
              planLabel={planLabel}
              user={user}
              role={role}
              unread={unread}
              mode={mode}
              memberships={memberships}
              items={items}
            />
            <Mark />
          </div>
          <p className="hidden text-sm text-muted-foreground md:block">
            {workspaceName}
            <span className="mx-2 text-border">/</span>
            {planLabel}
          </p>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {unread > 0 ? (
              <Link href={`/${surface}/notifications`} className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {unread} new
              </Link>
            ) : null}
            <span className="text-muted-foreground">{user?.name ?? "Guest"}</span>
          </div>
        </header>
        {readOnly ? (
          <div role="status" className="border-b bg-accent px-4 py-2 text-sm md:px-8">
            Read-only demo. Northwind Studio is sample data. Changes are disabled.
          </div>
        ) : null}
        {trialDays !== null ? (
          <div className="border-b px-4 py-2 text-sm text-muted-foreground md:px-8">
            Pro trial ends in {trialDays} day{trialDays === 1 ? "" : "s"}.{" "}
            <Link href={`/${surface}/settings/billing`} className="font-medium text-foreground underline-offset-4 hover:underline">
              Review plans
            </Link>
          </div>
        ) : null}
        <main id="main" className="px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}

function Sidebar(props: Omit<Parameters<typeof AppShell>[0], "children" | "readOnly" | "trialDays">) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href={props.surface === "demo" ? "/demo" : "/app"}>
        <Mark />
      </Link>
      <div>
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Workspace</p>
        <p className="mt-1 font-medium">{props.workspaceName}</p>
        <p className="text-xs text-muted-foreground">
          {props.planLabel}
          {props.role ? ` · ${props.role}` : ""}
        </p>
        {props.memberships.length > 1 ? (
          <form action={switchWorkspaceAction} className="mt-2">
            <label htmlFor="workspace-switch" className="sr-only">
              Switch workspace
            </label>
            <select id="workspace-switch" name="workspaceId" defaultValue={props.workspaceId} className="h-9 w-full rounded-lg border bg-background px-2 text-sm" onChange={(event) => event.currentTarget.form?.requestSubmit()}>
              {props.memberships.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </form>
        ) : null}
      </div>
      <nav aria-label="Workspace" className="grid gap-1">
        {props.items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn("rounded-lg px-2 py-1.5 text-sm hover:bg-sidebar-accent")}
          >
            {item.label}
            {item.label === "Notifications" && props.unread > 0 ? ` (${props.unread})` : ""}
          </Link>
        ))}
      </nav>
      <div className="mt-auto grid gap-2 text-xs text-muted-foreground">
        <p>
          Data {props.mode.data} · Payments {props.mode.payments} · Email {props.mode.email}
        </p>
        {props.user ? (
          <form action={logoutAction}>
            <Button type="submit" variant="outline" className="h-9 w-full">
              Log out
            </Button>
          </form>
        ) : (
          <Button render={<Link href="/signup" />} className="h-9">
            Start free
          </Button>
        )}
      </div>
    </div>
  )
}

function MobileNav(props: Omit<Parameters<typeof AppShell>[0], "children" | "readOnly" | "trialDays">) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="icon" aria-label="Open menu" />
        }
      >
        <Menu />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <Sidebar {...props} />
      </SheetContent>
    </Sheet>
  )
}
