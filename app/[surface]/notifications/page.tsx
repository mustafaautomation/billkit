import Link from "next/link"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/ui-bits"
import { Button } from "@/components/ui/button"
import { markNotificationsAction } from "@/lib/actions/app"
import { getAppContext } from "@/lib/context"
import { loadNotifications } from "@/lib/data/service"

export const metadata = { title: "Notifications" }

export default async function NotificationsPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params
  if (surface !== "app" && surface !== "demo") notFound()
  const context = await getAppContext(surface)
  const notes = await loadNotifications(context.actor)
  const base = `/${context.surface}`
  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Sent, viewed, paid, and overdue events for this workspace."
        action={
          context.readOnly ? null : (
            <form action={markNotificationsAction}>
              <Button type="submit" variant="outline" className="h-10">Mark all read</Button>
            </form>
          )
        }
      />
      {notes.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Nothing in the tray yet. Sending an invoice will land here.
        </p>
      ) : (
        <ul className="grid gap-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex items-center justify-between gap-3">
                <Link href={`${base}${note.href}`} className="font-medium underline-offset-4 hover:underline">{note.title}</Link>
                {!note.readAt ? <span className="text-xs text-primary">Unread</span> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{note.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
