import { AuthFrame } from "@/components/auth-frame"
import { ResetForm } from "@/components/auth-forms"

export const metadata = { title: "Choose a password" }

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = "" } = await searchParams
  return (
    <AuthFrame title="Choose a new password" subtitle="This replaces the old one immediately.">
      <ResetForm token={token} />
    </AuthFrame>
  )
}
