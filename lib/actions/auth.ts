"use server"

import { redirect } from "next/navigation"
import { isRedirectError } from "next/dist/client/components/redirect-error"
import { establishSession, hashNewPassword, loginWithPassword, logout, requireUser } from "@/lib/context"
import { ActionError } from "@/lib/data/errors"
import {
  acceptInvite,
  consumeAuthToken,
  issueAuthToken,
  registerUser,
  updatePassword,
} from "@/lib/data/service"
import { isSupabaseConfigured } from "@/lib/env"
import { getOrigin } from "@/lib/origin"
import { createSupabaseServer } from "@/lib/supabase/server"

export type FormState = { error: string; mockLink?: string }

function failure(error: unknown): FormState {
  if (isRedirectError(error)) throw error
  if (error instanceof ActionError) return { error: error.message }
  if (error instanceof Error && error.message) return { error: error.message }
  return { error: "Something went wrong. Try again." }
}

export async function loginAction(_state: FormState, formData: FormData): Promise<FormState> {
  try {
    await loginWithPassword(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""))
  } catch (error) {
    return failure(error)
  }
  redirect("/app")
}

export async function signupAction(_state: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "")
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")
  const workspaceName = String(formData.get("workspace") ?? "")
  try {
    if (isSupabaseConfigured()) {
      if (password.length < 10) return { error: "Use at least 10 characters." }
      const supabase = await createSupabaseServer()
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { name: name.trim() } },
      })
      if (error) return { error: error.message }
      if (!data.user) return { error: "Could not create the account." }
      await registerUser({
        name,
        email,
        password,
        workspaceName,
        passwordHash: "supabase",
        userId: data.user.id,
      })
      if (!data.session) {
        return { error: "Check your email to confirm the account, then log in." }
      }
    } else {
      const { user } = await registerUser({
        name,
        email,
        password,
        workspaceName,
        passwordHash: hashNewPassword(password),
      })
      await establishSession(user.id)
    }
  } catch (error) {
    return failure(error)
  }
  redirect("/app")
}

export async function forgotAction(_state: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
  try {
    const origin = await getOrigin()
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServer()
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      })
      if (error) return { error: error.message }
      return { error: "" }
    }
    const issued = await issueAuthToken(email, "reset", origin)
    return {
      error: "",
      mockLink: issued.link ?? undefined,
    }
  } catch (error) {
    return failure(error)
  }
}

export async function magicAction(_state: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
  try {
    const origin = await getOrigin()
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServer()
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${origin}/auth/callback` },
      })
      if (error) return { error: error.message }
      return { error: "" }
    }
    const issued = await issueAuthToken(email, "magic", origin)
    return { error: "", mockLink: issued.link ?? undefined }
  } catch (error) {
    return failure(error)
  }
}

export async function resetAction(_state: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "")
  const token = String(formData.get("token") ?? "")
  if (password.length < 10) return { error: "Use at least 10 characters." }
  try {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServer()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) return { error: error.message }
    } else {
      const user = await consumeAuthToken(token, "reset")
      if (!user) return { error: "This reset link is invalid or expired." }
      await updatePassword(user.id, hashNewPassword(password))
      await establishSession(user.id)
    }
  } catch (error) {
    return failure(error)
  }
  redirect("/app")
}

export async function logoutAction() {
  await logout()
  redirect("/")
}

export async function acceptInviteAction(formData: FormData) {
  const token = String(formData.get("token") ?? "")
  const user = await requireUser()
  try {
    const workspaceId = await acceptInvite(user, token)
    const { setWorkspaceCookie } = await import("@/lib/auth/session")
    await setWorkspaceCookie(workspaceId)
  } catch (error) {
    if (error instanceof ActionError) redirect(`/invite?token=${token}&error=${encodeURIComponent(error.message)}`)
    throw error
  }
  redirect("/app")
}
