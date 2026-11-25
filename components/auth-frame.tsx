import Link from "next/link"
import { Mark } from "@/components/brand"
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts"
import { isSupabaseConfigured } from "@/lib/env"

export function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8"><Mark /></Link>
      <h1 className="font-heading text-4xl tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </main>
  )
}

export function DemoAccounts() {
  if (isSupabaseConfigured()) return null
  return (
    <details className="mt-8 rounded-xl border p-4 text-sm">
      <summary className="cursor-pointer font-medium">Seeded studios</summary>
      <p className="mt-2 text-muted-foreground">Password for every seeded account: {DEMO_PASSWORD}</p>
      <ul className="mt-3 grid gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <li key={account.email}>
            <span className="font-medium">{account.name}</span>
            <span className="text-muted-foreground"> · {account.role} · {account.workspace}</span>
            <div>{account.email}</div>
          </li>
        ))}
      </ul>
    </details>
  )
}
