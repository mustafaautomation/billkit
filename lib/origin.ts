import "server-only"

import { headers } from "next/headers"

export async function getOrigin() {
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "127.0.0.1:3847"
  const proto = headerList.get("x-forwarded-proto") ?? "http"
  return `${proto}://${host}`
}
