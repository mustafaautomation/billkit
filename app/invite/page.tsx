import { acceptInviteAction } from "@/lib/actions/auth"
import { AuthFrame } from "@/components/auth-frame"
import { Button } from "@/components/ui/button"
import { currentUser } from "@/lib/context"

export const metadata = { title: "Accept invite" }

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const { token = "", error } = await searchParams
  const user = await currentUser()
  return (
    <AuthFrame title="Join a workspace" subtitle="Invites are tied to the email they were sent to.">
      {error ? <p role="alert" className="mb-4 text-sm text-destructive">{error}</p> : null}
      {user ? (
        <form action={acceptInviteAction} className="grid gap-3">
          <input type="hidden" name="token" value={token} />
          <p className="text-sm">Signed in as {user.email}.</p>
          <Button type="submit" className="h-10">Accept invite</Button>
        </form>
      ) : (
        <p className="text-sm">
          Log in or create an account with the invited email, then open this link again.
        </p>
      )}
    </AuthFrame>
  )
}
