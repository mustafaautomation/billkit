import "server-only"

/** Runtime env read. Bracket access stays dynamic across `next build`. */
export function env(name: string): string | undefined {
  const value = process.env[name]
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function isE2E(): boolean {
  return env("BILLKIT_E2E") === "1"
}

export function supabaseUrl(): string | undefined {
  return env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL")
}

export function supabaseAnonKey(): string | undefined {
  return env("SUPABASE_ANON_KEY") ?? env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
}

export function supabaseServiceKey(): string | undefined {
  return env("SUPABASE_SERVICE_ROLE_KEY")
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseAnonKey() && supabaseServiceKey())
}

export type IntegrationMode = {
  data: "supabase" | "memory"
  payments: "stripe" | "mock"
  email: "resend" | "mock"
  copy: "groq" | "gemini" | "mock"
}

export function integrationMode(): IntegrationMode {
  const copy = env("GROQ_API_KEY")
    ? "groq"
    : env("GEMINI_API_KEY")
      ? "gemini"
      : "mock"
  return {
    data: isSupabaseConfigured() ? "supabase" : "memory",
    payments: env("STRIPE_SECRET_KEY") ? "stripe" : "mock",
    email: env("RESEND_API_KEY") ? "resend" : "mock",
    copy,
  }
}
