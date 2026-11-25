import { beforeEach, describe, expect, it, vi } from "vitest"

// The service runs on the server; stub the Next.js-only imports so the
// in-memory store and business rules can be exercised directly.
vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}))

const { resetDatabase } = await import("@/lib/data/memory-store")
const { getStore } = await import("@/lib/data/get-store")
const service = await import("@/lib/data/service")
const { CLIENT, INVOICE, PAY, USER, WORKSPACE } = await import("@/lib/ids")

const maya = {
  kind: "user" as const,
  userId: USER.maya,
  workspaceId: WORKSPACE.northwind,
  role: "owner" as const,
  isSuperAdmin: false,
}

const origin = "http://127.0.0.1:3847"

beforeEach(() => {
  resetDatabase()
})

describe("public payment page", () => {
  it("records the first client view once", async () => {
    const opened = await service.openPublicInvoice(PAY.plover, origin)
    expect(opened.preview).toBeNull()
    expect(opened.invoice.status).toBe("viewed")
    const store = await getStore()
    const stored = await store.getInvoice(INVOICE.plover)
    expect(stored?.viewedAt).not.toBeNull()
  })

  it("does not mark viewed when a studio member or the demo opens it", async () => {
    const asMember = await service.openPublicInvoice(PAY.plover, origin, { userId: USER.leah })
    expect(asMember.preview).toBe("member")
    expect(asMember.invoice.status).toBe("sent")

    const fromDemo = await service.openPublicInvoice(PAY.plover, origin, { demo: true })
    expect(fromDemo.preview).toBe("demo")

    // A signed-in user from another workspace is just a visitor.
    const outsider = await service.openPublicInvoice(PAY.plover, origin, { userId: USER.maya })
    expect(outsider.preview).toBeNull()
    expect(outsider.invoice.status).toBe("viewed")
  })

  it("hides drafts", async () => {
    await expect(service.openPublicInvoice(PAY.atlas, origin)).rejects.toMatchObject({ code: "not_found" })
  })
})

describe("invoice numbering", () => {
  const draft = {
    clientId: CLIENT.harbor,
    issueDate: "2026-11-01",
    dueDate: "2026-11-15",
    taxPercent: 0,
    discountType: "none" as const,
    discountValue: 0,
    notes: "",
    lines: [{ description: "Workshop", quantity: 1, unitAmountCents: 10_000 }],
  }

  it("uses prefix-nextNumber and advances the counter", async () => {
    const created = await service.createOrUpdateInvoice(maya, draft)
    expect(created.number).toBe("NW-1050")
    const next = await service.createOrUpdateInvoice(maya, draft)
    expect(next.number).toBe("NW-1051")
  })

  it("skips numbers that already exist in the workspace", async () => {
    const store = await getStore()
    const workspace = await store.getWorkspace(WORKSPACE.northwind)
    if (!workspace) throw new Error("seed missing")
    await store.updateWorkspace({ ...workspace, nextNumber: 1048 })
    const created = await service.createOrUpdateInvoice(maya, draft)
    expect(created.number).toBe("NW-1050")
    expect((await store.getWorkspace(WORKSPACE.northwind))?.nextNumber).toBe(1051)
  })

  it("rejects writes from the demo actor", async () => {
    await expect(
      service.createOrUpdateInvoice({ kind: "demo", workspaceId: WORKSPACE.northwind }, draft),
    ).rejects.toMatchObject({ code: "readonly" })
  })
})
