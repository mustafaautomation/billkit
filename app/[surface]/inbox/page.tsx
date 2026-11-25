import { notFound } from "next/navigation"
import { PageHeader } from "@/components/ui-bits"
import { getAppContext } from "@/lib/context"
import { loadInbox } from "@/lib/data/service"

export const metadata = { title: "Inbox" }

export default async function InboxPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params
  if (surface !== "app" && surface !== "demo") notFound()
  const context = await getAppContext(surface)
  const emails = await loadInbox(context.actor)
  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Copies of invoice, reminder, and billing mail. Without Resend, this is the mailbox."
      />
      {emails.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No messages yet.
        </p>
      ) : (
        <ul className="grid gap-3">
          {emails.map((email) => (
            <li key={email.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <p className="text-xs text-muted-foreground">{email.kind} · {email.to}</p>
              <h2 className="mt-1 font-medium">{email.subject}</h2>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-muted-foreground">{email.body}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
