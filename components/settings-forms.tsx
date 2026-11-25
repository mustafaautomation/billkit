"use client"

import { useActionState } from "react"
import { billingAction, inviteAction, saveWorkspaceAction } from "@/lib/actions/app"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ErrorNote, Field } from "@/components/ui-bits"
import { formatMoney } from "@/lib/domain/money"
import { PLANS } from "@/lib/domain/plans"
import type { Workspace } from "@/lib/domain/types"

export function WorkspaceForm({ workspace, locked }: { workspace: Workspace; locked: boolean }) {
  const [state, action, pending] = useActionState(saveWorkspaceAction, { error: "" })
  return (
    <form action={action} className="grid max-w-xl gap-4">
      <ErrorNote>{state.error}</ErrorNote>
      <Field label="Workspace name" htmlFor="name">
        <Input id="name" name="name" defaultValue={workspace.name} required disabled={locked} className="h-10" />
      </Field>
      <Field label="Billing email" htmlFor="email">
        <Input id="email" name="email" type="email" defaultValue={workspace.email} required disabled={locked} className="h-10" />
      </Field>
      <Field label="Address" htmlFor="address">
        <Textarea id="address" name="address" defaultValue={workspace.address} disabled={locked} rows={4} />
      </Field>
      <Field label="Invoice prefix" htmlFor="prefix" hint="2 to 6 letters or numbers. New invoices use the next number.">
        <Input id="prefix" name="prefix" defaultValue={workspace.invoicePrefix} required disabled={locked} className="h-10" />
      </Field>
      {locked ? <p className="text-sm text-muted-foreground">Only the owner can change the workspace profile.</p> : (
        <Button type="submit" className="h-10 w-fit" disabled={pending}>Save workspace</Button>
      )}
    </form>
  )
}

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteAction, { error: "" })
  return (
    <form action={action} className="grid max-w-xl gap-3">
      <ErrorNote>{state.error}</ErrorNote>
      {state.text ? <p role="status" className="text-sm">{state.text}</p> : null}
      <Field label="Email" htmlFor="invite-email">
        <Input id="invite-email" name="email" type="email" required className="h-10" />
      </Field>
      <Button type="submit" className="h-10 w-fit" disabled={pending}>Invite member</Button>
      {state.mockLink ? (
        <p className="text-sm">
          Mock email. <a className="underline" href={state.mockLink}>Open invite link</a>
        </p>
      ) : null}
    </form>
  )
}

export function BillingForms({
  payments,
  canManage,
}: {
  payments: "stripe" | "mock"
  canManage: boolean
}) {
  if (!canManage) {
    return <p className="text-sm text-muted-foreground">Billing is limited to the workspace owner.</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      <form action={billingAction}>
        <input type="hidden" name="intent" value="upgrade" />
        <input type="hidden" name="plan" value="pro" />
        <Button type="submit" className="h-10">Upgrade to Pro · {formatMoney(PLANS.pro.monthlyCents)}</Button>
      </form>
      <form action={billingAction}>
        <input type="hidden" name="intent" value="upgrade" />
        <input type="hidden" name="plan" value="starter" />
        <Button type="submit" variant="outline" className="h-10">Switch to Starter · {formatMoney(PLANS.starter.monthlyCents)}</Button>
      </form>
      <form action={billingAction}>
        <input type="hidden" name="intent" value="cancel" />
        <Button type="submit" variant="destructive" className="h-10">Cancel subscription</Button>
      </form>
      <p className="basis-full text-xs text-muted-foreground">
        {payments === "stripe" ? "Checkout uses Stripe test mode." : "Stripe is not configured, so plan changes are simulated and nothing is charged."}
      </p>
    </div>
  )
}
