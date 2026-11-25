import "server-only"

import type { EmailKind, EmailMessage } from "@/lib/domain/types"
import { env } from "@/lib/env"
import type { Store } from "@/lib/data/store"

export async function deliverEmail(
  store: Store,
  input: {
    workspaceId: string | null
    to: string
    subject: string
    body: string
    kind: EmailKind
  },
): Promise<{ email: EmailMessage; channel: "resend" | "mock" }> {
  const email: EmailMessage = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    to: input.to,
    subject: input.subject,
    body: input.body,
    kind: input.kind,
    createdAt: new Date().toISOString(),
  }
  await store.insertEmail(email)
  const key = env("RESEND_API_KEY")
  if (!key) return { email, channel: "mock" }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env("RESEND_FROM") ?? "Billkit <billing@billkit.test>",
        to: input.to,
        subject: input.subject,
        text: input.body,
      }),
    })
    if (!response.ok) return { email, channel: "mock" }
    return { email, channel: "resend" }
  } catch {
    return { email, channel: "mock" }
  }
}
