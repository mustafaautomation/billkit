import "server-only"

import { notFound, redirect } from "next/navigation"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import {
  clearSession,
  readSessionUserId,
  readWorkspaceCookie,
  setSession,
} from "@/lib/auth/session"
import { getStore } from "@/lib/data/get-store"
import type { Actor } from "@/lib/data/service"
import { integrationMode, isSupabaseConfigured } from "@/lib/env"
import type { Role, User, Workspace } from "@/lib/domain/types"
import { createSupabaseServer } from "@/lib/supabase/server"

export async function currentUser(): Promise<User | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServer()
    const { data } = await supabase.auth.getUser()
    if (!data.user?.email) return null
    const store = await getStore()
    const profile = await store.findUserById(data.user.id)
    const metadata = data.user.app_metadata as { role?: string } | undefined
    return {
      id: data.user.id,
      email: data.user.email,
      name: profile?.name || String(data.user.user_metadata?.name ?? data.user.email),
      passwordHash: null,
      isSuperAdmin: metadata?.role === "superadmin",
      createdAt: data.user.created_at,
    }
  }
  const userId = await readSessionUserId()
  if (!userId) return null
  const store = await getStore()
  return store.findUserById(userId)
}

export async function requireUser(): Promise<User> {
  const user = await currentUser()
  if (!user) redirect("/login")
  return user
}

export async function loginWithPassword(email: string, password: string): Promise<User> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServer()
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw new Error("Email or password does not match.")
    const user = await currentUser()
    if (!user) throw new Error("Email or password does not match.")
    return user
  }
  const store = await getStore()
  const user = await store.findUserByEmail(email.trim().toLowerCase())
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Email or password does not match.")
  }
  await setSession(user.id)
  return user
}

export async function establishSession(userId: string) {
  if (!isSupabaseConfigured()) await setSession(userId)
}

export async function logout() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServer()
    await supabase.auth.signOut()
  }
  await clearSession()
}

export function hashNewPassword(password: string) {
  return hashPassword(password)
}

export type AppContext = {
  surface: "app" | "demo"
  readOnly: boolean
  user: User | null
  workspace: Workspace
  role: Role
  actor: Actor
  mode: ReturnType<typeof integrationMode>
  memberships: { workspace: Workspace; role: Role }[]
  unread: number
}

export async function getAppContext(surface: string): Promise<AppContext> {
  if (surface !== "app" && surface !== "demo") notFound()
  const store = await getStore()
  const mode = integrationMode()
  if (surface === "demo") {
    const workspace = await store.getWorkspaceBySlug("northwind-studio")
    if (!workspace) notFound()
    const members = await store.listMembers(workspace.id)
    const owner = members.find((member) => member.role === "owner")
    const notes = owner ? await store.listNotifications(owner.userId, workspace.id) : []
    return {
      surface,
      readOnly: true,
      user: null,
      workspace,
      role: "owner",
      actor: { kind: "demo", workspaceId: workspace.id },
      mode,
      memberships: [],
      unread: notes.filter((note) => !note.readAt).length,
    }
  }
  const user = await requireUser()
  const memberships = await store.listWorkspacesForUser(user.id)
  const preferred = await readWorkspaceCookie()
  const chosen = memberships.find((item) => item.workspace.id === preferred) ?? memberships[0]
  if (!chosen) notFound()
  const notes = await store.listNotifications(user.id, chosen.workspace.id)
  return {
    surface: "app",
    readOnly: false,
    user,
    workspace: chosen.workspace,
    role: chosen.role,
    actor: {
      kind: "user",
      userId: user.id,
      workspaceId: chosen.workspace.id,
      role: chosen.role,
      isSuperAdmin: user.isSuperAdmin,
    },
    mode,
    memberships,
    unread: notes.filter((note) => !note.readAt).length,
  }
}
