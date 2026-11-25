import "server-only"

import type { Client, PricedInvoice, Workspace } from "@/lib/domain/types"
import { formatMoney } from "@/lib/domain/money"
import { env } from "@/lib/env"

export type ReminderDraft = {
  text: string
  source: "groq" | "gemini" | "mock"
  note?: string
}

function mockReminder(input: {
  workspace: Workspace
  client: Client
  invoice: PricedInvoice
  payUrl: string
  senderName: string
}): string {
  const first = input.client.name.split(" ")[0]
  return `Hi ${first},

I hope the work landed well. Invoice ${input.invoice.number} from ${input.workspace.name} for ${formatMoney(input.invoice.totalCents)} was due ${input.invoice.dueDate}.

If it is already in motion, please ignore this note. Otherwise the payment page is here:
${input.payUrl}

Thank you,
${input.senderName}
${input.workspace.name}`
}

function prompt(input: {
  workspace: Workspace
  client: Client
  invoice: PricedInvoice
  payUrl: string
  senderName: string
}): string {
  return `Write a short plain-text payment reminder email. No markdown, no subject line, under 130 words. Warm and specific, never threatening.

Studio: ${input.workspace.name}
Sender: ${input.senderName}
Client: ${input.client.name} at ${input.client.company}
Invoice: ${input.invoice.number}
Amount: ${formatMoney(input.invoice.totalCents)}
Due: ${input.invoice.dueDate}
Status: ${input.invoice.displayStatus}
Notes: ${input.invoice.notes || "none"}
Payment link: ${input.payUrl}`
}

export async function writeReminder(input: {
  workspace: Workspace
  client: Client
  invoice: PricedInvoice
  payUrl: string
  senderName: string
}): Promise<ReminderDraft> {
  const fallback = mockReminder(input)
  const groq = env("GROQ_API_KEY")
  if (groq) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groq}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env("GROQ_MODEL") ?? "llama-3.3-70b-versatile",
          temperature: 0.4,
          messages: [
            {
              role: "system",
              content: "You write short professional invoice reminders. Plain text only.",
            },
            { role: "user", content: prompt(input) },
          ],
        }),
      })
      if (response.ok) {
        const json = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>
        }
        const text = json.choices?.[0]?.message?.content?.trim()
        if (text) return { text, source: "groq" }
      }
    } catch {
      // fall through
    }
    return {
      text: fallback,
      source: "mock",
      note: "Groq did not return a draft, so this is the standard reminder.",
    }
  }
  const gemini = env("GEMINI_API_KEY")
  if (gemini) {
    try {
      const model = env("GEMINI_MODEL") ?? "gemini-2.0-flash"
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemini}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt(input) }] }],
          }),
        },
      )
      if (response.ok) {
        const json = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        if (text) return { text, source: "gemini" }
      }
    } catch {
      // fall through
    }
    return {
      text: fallback,
      source: "mock",
      note: "Gemini did not return a draft, so this is the standard reminder.",
    }
  }
  return { text: fallback, source: "mock" }
}
