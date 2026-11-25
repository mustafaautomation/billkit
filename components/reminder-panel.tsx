"use client"

import { useActionState } from "react"
import { reminderAction, sendReminderAction } from "@/lib/actions/app"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ErrorNote } from "@/components/ui-bits"

export function ReminderPanel({ surface, invoiceId }: { surface: string; invoiceId: string }) {
  const [draft, draftAction, drafting] = useActionState(reminderAction, { error: "" })
  const [sent, sendAction, sending] = useActionState(sendReminderAction, { error: "" })
  return (
    <div className="grid gap-3">
      <form action={draftAction}>
        <input type="hidden" name="surface" value={surface} />
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <Button type="submit" variant="outline" className="h-10" disabled={drafting}>
          {drafting ? "Writing…" : "Write reminder"}
        </Button>
      </form>
      <ErrorNote>{draft.error}</ErrorNote>
      {draft.note ? <p className="text-sm text-muted-foreground">{draft.note}</p> : null}
      {draft.text ? (
        <form action={sendAction} className="grid gap-2">
          <input type="hidden" name="surface" value={surface} />
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <label htmlFor="reminder-body" className="text-sm font-medium">Reminder</label>
          <Textarea id="reminder-body" name="body" defaultValue={draft.text} rows={8} />
          <p className="text-xs text-muted-foreground">Draft source: {draft.source}</p>
          <ErrorNote>{sent.error}</ErrorNote>
          <Button type="submit" className="h-10 w-fit" disabled={sending}>
            {sending ? "Sending…" : "Send reminder"}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
