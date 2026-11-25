import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseAnonKey, supabaseUrl } from "@/lib/env"

export async function createSupabaseServer() {
  const url = supabaseUrl()
  const key = supabaseAnonKey()
  if (!url || !key) throw new Error("Supabase is not configured")
  const cookieStore = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie.options)
          }
        } catch {
          // Server Components cannot always write cookies. The action or route will.
        }
      },
    },
  })
}
