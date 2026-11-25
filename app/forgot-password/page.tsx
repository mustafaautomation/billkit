import { AuthFrame } from "@/components/auth-frame"
import { ForgotForm } from "@/components/auth-forms"

export const metadata = { title: "Reset password" }

export default function ForgotPage() {
  return (
    <AuthFrame title="Reset your password" subtitle="We will send a one-hour link. In mock mode it appears on this page.">
      <ForgotForm />
    </AuthFrame>
  )
}
