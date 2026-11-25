import { AuthFrame } from "@/components/auth-frame"
import { MagicForm } from "@/components/auth-forms"

export const metadata = { title: "Magic link" }

export default async function MagicPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <AuthFrame title="Sign in by email" subtitle="No password. The link expires in an hour.">
      <MagicForm error={error ? "That sign-in link is invalid or expired." : undefined} />
    </AuthFrame>
  )
}
