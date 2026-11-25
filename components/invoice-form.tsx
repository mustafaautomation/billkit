"use client"

import { useActionState, useState } from "react"
import { saveInvoiceAction, type FormState } from "@/lib/actions/app"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { controlClass, ErrorNote, Field } from "@/components/ui-bits"
import type { Client, PricedInvoice } from "@/lib/domain/types"

type Line = { key: string; description: string; quantity: string; rate: string }

function money(cents: number) {
  return (cents / 100).toFixed(2)
}

export function InvoiceForm({
  surface,
  clients,
  invoice,
  issueDate,
  dueDate,
}: {
  surface: "app" | "demo"
  clients: Client[]
  invoice?: PricedInvoice
  issueDate?: string
  dueDate?: string
}) {
  const [state, action, pending] = useActionState(saveInvoiceAction, { error: "" } satisfies FormState)
  const [discountType, setDiscountType] = useState(invoice?.discountType ?? "none")
  const [lines, setLines] = useState<Line[]>(
    invoice?.lines.map((line) => ({
      key: line.id,
      description: line.description,
      quantity: String(line.quantity),
      rate: money(line.unitAmountCents),
    })) ?? [{ key: "line-1", description: "", quantity: "1", rate: "" }],
  )

  function update(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="surface" value={surface} />
      {invoice ? <input type="hidden" name="invoiceId" value={invoice.id} /> : null}
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(
          lines.map((line) => ({
            description: line.description,
            quantity: Number(line.quantity),
            rate: line.rate,
          })),
        )}
      />
      <ErrorNote>{state.error}</ErrorNote>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Client" htmlFor="clientId">
          <select id="clientId" name="clientId" required className={controlClass} defaultValue={invoice?.clientId ?? ""}>
            <option value="" disabled>
              Choose a client
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.company} · {client.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Issue date" htmlFor="issueDate">
            <Input id="issueDate" name="issueDate" type="date" required className="h-10" defaultValue={invoice?.issueDate ?? issueDate} />
          </Field>
          <Field label="Due date" htmlFor="dueDate">
            <Input id="dueDate" name="dueDate" type="date" required className="h-10" defaultValue={invoice?.dueDate ?? dueDate} />
          </Field>
        </div>
      </div>
      <div className="grid gap-3">
        {lines.map((line, index) => (
          <fieldset key={line.key} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1fr_100px_120px_auto]">
            <legend className="px-1 text-xs text-muted-foreground">Line {index + 1}</legend>
            <Field label={index === 0 ? "Description" : `Description ${index + 1}`} htmlFor={`desc-${line.key}`}>
              <Input id={`desc-${line.key}`} value={line.description} onChange={(event) => update(line.key, { description: event.target.value })} required className="h-10" />
            </Field>
            <Field label={index === 0 ? "Quantity" : `Quantity ${index + 1}`} htmlFor={`qty-${line.key}`}>
              <Input id={`qty-${line.key}`} inputMode="decimal" value={line.quantity} onChange={(event) => update(line.key, { quantity: event.target.value })} required className="h-10" />
            </Field>
            <Field label={index === 0 ? "Rate" : `Rate ${index + 1}`} htmlFor={`rate-${line.key}`}>
              <Input id={`rate-${line.key}`} inputMode="decimal" value={line.rate} onChange={(event) => update(line.key, { rate: event.target.value })} required className="h-10" placeholder="0.00" />
            </Field>
            {lines.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                className="self-end"
                onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
              >
                Remove line
              </Button>
            ) : <span />}
          </fieldset>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-10 w-fit"
          onClick={() => setLines((current) => [...current, { key: crypto.randomUUID(), description: "", quantity: "1", rate: "" }])}
        >
          Add line
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Tax rate" htmlFor="taxPercent" hint="Percent. 8.25 is fine.">
          <Input id="taxPercent" name="taxPercent" inputMode="decimal" defaultValue={invoice ? (invoice.taxRateBps / 100).toString() : "0"} className="h-10" />
        </Field>
        <Field label="Discount type" htmlFor="discountType">
          <select
            id="discountType"
            name="discountType"
            className={controlClass}
            value={discountType}
            onChange={(event) => setDiscountType(event.target.value as "none" | "percent" | "fixed")}
          >
            <option value="none">None</option>
            <option value="percent">Percent</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </Field>
        {discountType !== "none" ? (
          <Field label="Discount amount" htmlFor="discountValue" hint={discountType === "percent" ? "Percent off the subtotal." : "Dollars off the subtotal."}>
            <Input
              id="discountValue"
              name="discountValue"
              inputMode="decimal"
              defaultValue={
                invoice && invoice.discountType !== "none"
                  ? invoice.discountType === "percent"
                    ? String(invoice.discountValue / 100)
                    : money(invoice.discountValue)
                  : "0"
              }
              className="h-10"
            />
          </Field>
        ) : (
          <input type="hidden" name="discountValue" value="0" />
        )}
      </div>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={invoice?.notes ?? ""} rows={4} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="intent" value="draft" variant="outline" className="h-10" disabled={pending}>
          Save draft
        </Button>
        <Button type="submit" name="intent" value="send" className="h-10" disabled={pending}>
          {pending ? "Saving…" : "Save and send"}
        </Button>
      </div>
    </form>
  )
}
