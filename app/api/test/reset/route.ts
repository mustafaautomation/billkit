import { resetDatabase } from "@/lib/data/memory-store"
import { isE2E } from "@/lib/env"

export async function POST() {
  if (!isE2E()) return Response.json({ error: "Not found" }, { status: 404 })
  resetDatabase()
  return Response.json({ ok: true })
}
