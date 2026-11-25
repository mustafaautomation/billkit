import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { env } from "@/lib/env"

const SESSION = "bk_session"
const WORKSPACE = "bk_workspace"
const MAX_AGE = 60 * 60 * 24 * 14

function secret(): string {
  return (
    env("SESSION_SECRET") ??
    "billkit-mock-mode-session-key-v1"
  )
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url")
}

export function encodeSession(userId: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ uid: userId, exp: now + MAX_AGE * 1000 })).toString(
    "base64url",
  )
  return `${body}.${sign(body)}`
}

export function decodeSession(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null
  const [body, signature] = token.split(".")
  if (!body || !signature) return null
  const expected = sign(body)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      uid?: string
      exp?: number
    }
    if (!payload.uid || !payload.exp || payload.exp < now) return null
    return payload.uid
  } catch {
    return null
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env("VERCEL") === "1",
    path: "/",
    maxAge: MAX_AGE,
  }
}

export async function setSession(userId: string) {
  const jar = await cookies()
  jar.set(SESSION, encodeSession(userId), cookieOptions())
}

export async function clearSession() {
  const jar = await cookies()
  jar.delete(SESSION)
  jar.delete(WORKSPACE)
}

export async function readSessionUserId(): Promise<string | null> {
  const jar = await cookies()
  return decodeSession(jar.get(SESSION)?.value)
}

export async function readWorkspaceCookie(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(WORKSPACE)?.value ?? null
}

export async function setWorkspaceCookie(workspaceId: string) {
  const jar = await cookies()
  jar.set(WORKSPACE, workspaceId, cookieOptions())
}
