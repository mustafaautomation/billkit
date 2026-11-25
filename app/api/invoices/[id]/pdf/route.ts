import { invoicePdfSource } from "@/lib/data/service"
import { renderInvoicePdf } from "@/lib/pdf/invoice"
import { currentUser, getAppContext } from "@/lib/context"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const token = new URL(request.url).searchParams.get("token")
  let actor = null
  if (!token) {
    const user = await currentUser()
    if (user) {
      try {
        const app = await getAppContext("app")
        actor = app.actor
      } catch {
        actor = null
      }
    }
  }
  const source = await invoicePdfSource(id, token, actor)
  if (!source) return new Response("Not found", { status: 404 })
  const bytes = await renderInvoicePdf(source)
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${source.invoice.number}.pdf"`,
    },
  })
}
