import Link from "next/link"
import { AuthFrame } from "@/components/auth-frame"
import { SignupForm } from "@/components/auth-forms"

export const metadata = { title: "Create a workspace" }

export default function SignupPage() {
  return (
    <AuthFrame title="Open a workspace" subtitle="Fourteen days of Pro, then Starter unless you upgrade.">
      <SignupForm />
      <p className="mt-4 text-sm text-muted-foreground">
        Already billing? <Link href="/login" className="underline-offset-4 hover:underline">Log in</Link>
      </p>
    </AuthFrame>
  )
}
