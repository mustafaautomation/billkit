import "server-only"

import { headers } from "next/headers"
import { isSupabaseConfigured } from "@/lib/env"
import { memoryStore } from "@/lib/data/memory-store"
import type { Store } from "@/lib/data/store"

/** True when the request comes from the read-only /demo surface (header or referer). */
export async function isDemoRequest() {
  try {
    const headerList = await headers()
    if (headerList.get("x-billkit-surface") === "demo") return true
    const referer = headerList.get("referer") ?? ""
    return /\/demo(\/|$|\?)/.test(referer)
  } catch {
    return false
  }
}

export async function getStore(): Promise<Store> {
  if (await isDemoRequest()) return memoryStore
  if (isSupabaseConfigured()) {
    const { createSupabaseStore } = await import("@/lib/data/supabase-store")
    return createSupabaseStore()
  }
  return memoryStore
}
