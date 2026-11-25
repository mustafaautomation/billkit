"use client"

import { useActionState } from "react"
import { saveClientAction } from "@/lib/actions/app"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ErrorNote, Field } from "@/components/ui-bits"
import type { Client } from "@/lib/domain/types"

export function ClientForm({ surface, client }: { surface: "app" | "demo"; client?: Client }) {
  const [state, action, pending] = useActionState(saveClientAction, { error: "" })
  return (
    <form action={action} className="grid max-w-xl gap-4">
      <input type="hidden" name="surface" value={surface} />
      {client ? <input type="hidden" name="clientId" value={client.id} /> : null}
      <ErrorNote>{state.error}</ErrorNote>
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required defaultValue={client?.name} className="h-10" autoComplete="name" />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required defaultValue={client?.email} className="h-10" autoComplete="email" />
      </Field>
      <Field label="Company" htmlFor="company">
        <Input id="company" name="company" required defaultValue={client?.company} className="h-10" />
      </Field>
      <Field label="Address" htmlFor="address">
        <Textarea id="address" name="address" defaultValue={client?.address} rows={3} />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={client?.notes} rows={3} />
      </Field>
      <Button type="submit" className="h-10 w-fit" disabled={pending}>
        {pending ? "Saving…" : "Save client"}
      </Button>
    </form>
  )
}
