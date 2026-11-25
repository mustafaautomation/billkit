import { redirect } from "next/navigation"
import { isSupabaseConfigured } from "@/lib/env"
import { createSupabaseServer } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next") || "/app"
  if (code && isSupabaseConfigured()) {
    const supabase = await createSupabaseServer()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) redirect("/login")
  }
  redirect(next.startsWith("/") ? next : "/app")
}
