import { connection } from "next/server"
import { AuthFrame, DemoAccounts } from "@/components/auth-frame"
import { LoginForm } from "@/components/auth-forms"

export const metadata = { title: "Log in" }

export default async function LoginPage() {
  await connection()
  return (
    <AuthFrame title="Log in" subtitle="Pick up the ledger where you left it.">
      <LoginForm />
      <DemoAccounts />
    </AuthFrame>
  )
}
