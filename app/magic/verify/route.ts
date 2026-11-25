import { redirect } from "next/navigation"
import { establishSession } from "@/lib/context"
import { consumeAuthToken } from "@/lib/data/service"

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? ""
  const user = await consumeAuthToken(token, "magic")
  if (!user) redirect("/magic?error=invalid")
  await establishSession(user.id)
  redirect("/app")
}
