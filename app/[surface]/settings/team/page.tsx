import { notFound } from "next/navigation"
import { InviteForm } from "@/components/settings-forms"
import { PageHeader } from "@/components/ui-bits"
import { Button } from "@/components/ui/button"
import { removeMemberAction } from "@/lib/actions/app"
import { getAppContext } from "@/lib/context"
import { loadTeam } from "@/lib/data/service"

export const metadata = { title: "Team" }

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ surface: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { surface } = await params
  if (surface !== "app" && surface !== "demo") notFound()
  const { error } = await searchParams
  const context = await getAppContext(surface)
  const data = await loadTeam(context.actor)
  const owner = !context.readOnly && context.role === "owner"
  return (
    <div>
      <PageHeader
        title="Team"
        description={`${data.members.length} of ${data.entitlements.seatLimit} seats used on ${data.entitlements.label}.`}
      />
      {error ? <p role="alert" className="mb-4 text-sm text-destructive">{error}</p> : null}
      <ul className="mb-6 divide-y rounded-xl bg-card ring-1 ring-foreground/10">
        {data.members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <div>
              <p className="font-medium">{member.user.name}</p>
              <p className="text-muted-foreground">{member.user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="capitalize">{member.role}</span>
              {owner && member.role === "member" ? (
                <form action={removeMemberAction}>
                  <input type="hidden" name="membershipId" value={member.id} />
                  <Button type="submit" variant="ghost" size="sm">Remove</Button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {owner ? <InviteForm /> : <p className="text-sm text-muted-foreground">Only the owner can invite people.</p>}
    </div>
  )
}
