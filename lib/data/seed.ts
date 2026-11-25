import { hashPassword } from "@/lib/auth/password"
import { DEMO_PASSWORD } from "@/lib/demo-accounts"
import type {
  Client,
  Database,
  EmailMessage,
  Invoice,
  InvoiceLine,
  InvoiceStatus,
  Membership,
  Notification,
  User,
  Workspace,
} from "@/lib/domain/types"
import { CLIENT, INVOICE, PAY, USER, WORKSPACE } from "@/lib/ids"

function isoDay(now: Date, dayOffset: number): string {
  const date = new Date(now.getTime())
  date.setUTCDate(date.getUTCDate() + dayOffset)
  return date.toISOString().slice(0, 10)
}

function stamp(now: Date, monthOffset: number, dayOfMonth: number): string {
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, dayOfMonth, 15, 0, 0),
  )
  return date.toISOString()
}

function paidThisMonth(now: Date): string {
  const day = Math.max(1, now.getUTCDate() - 2)
  return stamp(now, 0, day)
}

function line(description: string, quantity: number, unitAmountCents: number): InvoiceLine {
  return {
    id: crypto.randomUUID(),
    description,
    quantity,
    unitAmountCents,
  }
}

function invoice(
  partial: Pick<Invoice, "id" | "workspaceId" | "clientId" | "number" | "status" | "issueDate" | "dueDate" | "publicToken" | "lines"> &
    Partial<Invoice>,
): Invoice {
  return {
    currency: "USD",
    taxRateBps: 0,
    discountType: "none",
    discountValue: 0,
    notes: "",
    sentAt: null,
    viewedAt: null,
    paidAt: null,
    voidedAt: null,
    createdAt: `${partial.issueDate}T15:00:00.000Z`,
    updatedAt: `${partial.issueDate}T15:00:00.000Z`,
    ...partial,
  }
}

function client(
  id: string,
  workspaceId: string,
  name: string,
  email: string,
  company: string,
  address: string,
  notes = "",
): Client {
  return {
    id,
    workspaceId,
    name,
    email,
    company,
    address,
    notes,
    createdAt: "2026-01-15T15:00:00.000Z",
  }
}

export function buildSeed(now: Date): Database {
  const passwordHash = hashPassword(DEMO_PASSWORD)
  const created = "2025-06-02T15:00:00.000Z"

  const users: User[] = [
    {
      id: USER.maya,
      email: "maya@northwind.studio",
      name: "Maya Chen",
      passwordHash,
      isSuperAdmin: false,
      createdAt: created,
    },
    {
      id: USER.owen,
      email: "owen@northwind.studio",
      name: "Owen Park",
      passwordHash,
      isSuperAdmin: false,
      createdAt: created,
    },
    {
      id: USER.leah,
      email: "leah@cedar.legal",
      name: "Leah Okonkwo",
      passwordHash,
      isSuperAdmin: false,
      createdAt: created,
    },
    {
      id: USER.root,
      email: "root@billkit.test",
      name: "Billkit Root",
      passwordHash,
      isSuperAdmin: true,
      createdAt: created,
    },
  ]

  const workspaces: Workspace[] = [
    {
      id: WORKSPACE.northwind,
      name: "Northwind Studio",
      slug: "northwind-studio",
      plan: "starter",
      subscriptionStatus: "trialing",
      trialEndsAt: isoDay(now, 9),
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      invoicePrefix: "NW",
      nextNumber: 1050,
      address: "418 Mercer Street, Suite 6\nPortland, OR 97209",
      email: "billing@northwind.studio",
      createdAt: created,
    },
    {
      id: WORKSPACE.cedar,
      name: "Cedar Legal",
      slug: "cedar-legal",
      plan: "pro",
      subscriptionStatus: "active",
      trialEndsAt: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: isoDay(now, 20),
      invoicePrefix: "CL",
      nextNumber: 2205,
      address: "12 Pine Wharf\nProvidence, RI 02903",
      email: "billing@cedar.legal",
      createdAt: created,
    },
    {
      id: WORKSPACE.ops,
      name: "Billkit Ops",
      slug: "billkit-ops",
      plan: "starter",
      subscriptionStatus: "active",
      trialEndsAt: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: isoDay(now, 28),
      invoicePrefix: "BK",
      nextNumber: 1001,
      address: "Remote",
      email: "root@billkit.test",
      createdAt: created,
    },
  ]

  const memberships: Membership[] = [
    { id: crypto.randomUUID(), workspaceId: WORKSPACE.northwind, userId: USER.maya, role: "owner", createdAt: created },
    { id: crypto.randomUUID(), workspaceId: WORKSPACE.northwind, userId: USER.owen, role: "member", createdAt: created },
    { id: crypto.randomUUID(), workspaceId: WORKSPACE.cedar, userId: USER.leah, role: "owner", createdAt: created },
    { id: crypto.randomUUID(), workspaceId: WORKSPACE.ops, userId: USER.root, role: "owner", createdAt: created },
  ]

  const clients: Client[] = [
    client(CLIENT.harbor, WORKSPACE.northwind, "Priya Raman", "priya@harborandco.example", "Harbor & Co", "88 Water Street\nBrooklyn, NY 11201", "Brand retainer. Prefers PDF and a short note."),
    client(CLIENT.lumen, WORKSPACE.northwind, "Alex Petter", "ap@lumenhotels.example", "Lumen Hotels", "410 Market Street\nSan Francisco, CA 94105"),
    client(CLIENT.fieldnote, WORKSPACE.northwind, "June Adler", "hello@fieldnote.example", "Fieldnote Coffee", "19 Division Street\nPortland, OR 97202", "Pays from a shared inbox."),
    client(CLIENT.atlas, WORKSPACE.northwind, "Samir Shah", "finance@atlastransit.example", "Atlas Transit", "700 King Street\nSeattle, WA 98104"),
    client(CLIENT.kindred, WORKSPACE.northwind, "Nora Blake", "studio@kindredgoods.example", "Kindred Goods", "25 Oak Lane\nAustin, TX 78702"),
    client(CLIENT.marlowe, WORKSPACE.northwind, "Eliot Marsh", "ops@marlowebooks.example", "Marlowe Books", "4 Chapel Street\nHudson, NY 12534"),
    client(CLIENT.sable, WORKSPACE.northwind, "Ruth Keller", "accounts@sableinteriors.example", "Sable Interiors", "901 Canyon Road\nSanta Fe, NM 87501"),
    client(CLIENT.hart, WORKSPACE.cedar, "Helen Hart", "trustee@hartfamily.example", "Hart Family Trust", "2 Benefit Street\nProvidence, RI 02903"),
    client(CLIENT.plover, WORKSPACE.cedar, "Chris Doyle", "legal@plover.example", "Plover Manufacturing", "440 Mill Road\nWorcester, MA 01602"),
    client(CLIENT.ives, WORKSPACE.cedar, "Mina Ives", "hello@ivesdaughter.example", "Ives & Daughter", "15 Thayer Street\nProvidence, RI 02906"),
    client(CLIENT.redkite, WORKSPACE.cedar, "Owen Blake", "ops@redkite.example", "Red Kite Capital", "200 Clarendon Street\nBoston, MA 02116"),
  ]

  const harborPaid = stamp(now, -5, 12)
  const kindredPaid = stamp(now, -3, 12)
  const postersPaid = paidThisMonth(now)
  const hartPaid = paidThisMonth(now)

  const invoices: Invoice[] = [
    invoice({
      id: INVOICE.harbor,
      workspaceId: WORKSPACE.northwind,
      clientId: CLIENT.harbor,
      number: "NW-1042",
      status: "paid",
      issueDate: stamp(now, -5, 2).slice(0, 10),
      dueDate: stamp(now, -5, 16).slice(0, 10),
      publicToken: PAY.harbor,
      lines: [
        line("Brand strategy workshop", 1, 320_000),
        line("Visual identity system", 1, 640_000),
        line("Guidelines and templates", 1, 180_000),
      ],
      notes: "Final files delivered with the identity. Thank you for a calm project.",
      sentAt: stamp(now, -5, 2),
      viewedAt: stamp(now, -5, 4),
      paidAt: harborPaid,
      updatedAt: harborPaid,
    }),
    invoice({
      id: INVOICE.lumen,
      workspaceId: WORKSPACE.northwind,
      clientId: CLIENT.lumen,
      number: "NW-1043",
      status: "viewed",
      issueDate: isoDay(now, -20),
      dueDate: isoDay(now, 10),
      publicToken: PAY.lumen,
      lines: [
        line("Site architecture", 1, 240_000),
        line("Page design", 6, 96_000),
        line("Clickable prototype", 1, 48_000),
      ],
      notes: "Phase two of the hotel site. Scope is locked to the page list in the SOW.",
      sentAt: new Date(Date.parse(`${isoDay(now, -12)}T15:00:00.000Z`)).toISOString(),
      viewedAt: new Date(Date.parse(`${isoDay(now, -2)}T15:00:00.000Z`)).toISOString(),
    }),
    invoice({
      id: INVOICE.fieldnote,
      workspaceId: WORKSPACE.northwind,
      clientId: CLIENT.fieldnote,
      number: "NW-1044",
      status: "overdue" satisfies InvoiceStatus,
      issueDate: isoDay(now, -40),
      dueDate: isoDay(now, -18),
      publicToken: PAY.fieldnote,
      lines: [
        line("Packaging dielines", 1, 180_000),
        line("Print management", 1, 95_000),
        line("Press check", 4, 12_500),
      ],
      notes: "Bags and labels for the winter roast. Net 15.",
      sentAt: new Date(Date.parse(`${isoDay(now, -30)}T15:00:00.000Z`)).toISOString(),
      viewedAt: new Date(Date.parse(`${isoDay(now, -21)}T15:00:00.000Z`)).toISOString(),
    }),
    invoice({
      id: INVOICE.atlas,
      workspaceId: WORKSPACE.northwind,
      clientId: CLIENT.atlas,
      number: "NW-1045",
      status: "draft",
      issueDate: isoDay(now, 0),
      dueDate: isoDay(now, 21),
      publicToken: PAY.atlas,
      lines: [
        line("Wayfinding audit", 1, 280_000),
        line("Signage schedule", 1, 400_000),
      ],
      notes: "Waiting on the station list from their operations lead.",
    }),
    invoice({
      id: INVOICE.kindred,
      workspaceId: WORKSPACE.northwind,
      clientId: CLIENT.kindred,
      number: "NW-1046",
      status: "paid",
      issueDate: stamp(now, -3, 3).slice(0, 10),
      dueDate: stamp(now, -3, 17).slice(0, 10),
      publicToken: PAY.kindred,
      discountType: "percent",
      discountValue: 1000,
      lines: [
        line("Campaign concept", 1, 275_000),
        line("Art direction", 3, 100_000),
      ],
      notes: "Ten percent courtesy discount agreed for the holiday series.",
      sentAt: stamp(now, -3, 3),
      viewedAt: stamp(now, -3, 5),
      paidAt: kindredPaid,
      updatedAt: kindredPaid,
    }),
    invoice({
      id: INVOICE.marlowe,
      workspaceId: WORKSPACE.northwind,
      clientId: CLIENT.marlowe,
      number: "NW-1047",
      status: "overdue",
      issueDate: isoDay(now, -70),
      dueDate: isoDay(now, -46),
      publicToken: PAY.marlowe,
      taxRateBps: 825,
      lines: [
        line("Rebrand discovery", 1, 450_000),
        line("Cover system", 1, 540_000),
      ],
      notes: "Net 30 was written into the statement of work.",
      sentAt: new Date(Date.parse(`${isoDay(now, -60)}T15:00:00.000Z`)).toISOString(),
      viewedAt: new Date(Date.parse(`${isoDay(now, -50)}T15:00:00.000Z`)).toISOString(),
    }),
    invoice({
      id: INVOICE.sable,
      workspaceId: WORKSPACE.northwind,
      clientId: CLIENT.sable,
      number: "NW-1048",
      status: "void",
      issueDate: isoDay(now, -20),
      dueDate: isoDay(now, 10),
      publicToken: PAY.sable,
      lines: [line("Art direction retainer", 1, 220_000)],
      notes: "Project paused before kickoff. Voided at the client's request.",
      voidedAt: new Date(Date.parse(`${isoDay(now, -10)}T15:00:00.000Z`)).toISOString(),
    }),
    invoice({
      id: INVOICE.posters,
      workspaceId: WORKSPACE.northwind,
      clientId: CLIENT.atlas,
      number: "NW-1049",
      status: "paid",
      issueDate: isoDay(now, -6),
      dueDate: isoDay(now, 8),
      publicToken: PAY.posters,
      lines: [
        line("Poster series", 8, 45_000),
        line("Production files", 1, 55_000),
      ],
      notes: "Eight station posters, print-ready.",
      sentAt: new Date(Date.parse(`${isoDay(now, -6)}T15:00:00.000Z`)).toISOString(),
      viewedAt: new Date(Date.parse(`${isoDay(now, -5)}T15:00:00.000Z`)).toISOString(),
      paidAt: postersPaid,
      updatedAt: postersPaid,
    }),
    invoice({
      id: INVOICE.hart,
      workspaceId: WORKSPACE.cedar,
      clientId: CLIENT.hart,
      number: "CL-2201",
      status: "paid",
      issueDate: isoDay(now, -12),
      dueDate: isoDay(now, 2),
      publicToken: PAY.hart,
      lines: [
        line("Estate plan review", 1, 450_000),
        line("Trust amendment", 1, 300_000),
      ],
      notes: "Flat fee. Disbursements are billed separately and are not on this invoice.",
      sentAt: new Date(Date.parse(`${isoDay(now, -12)}T15:00:00.000Z`)).toISOString(),
      viewedAt: new Date(Date.parse(`${isoDay(now, -10)}T15:00:00.000Z`)).toISOString(),
      paidAt: hartPaid,
      updatedAt: hartPaid,
    }),
    invoice({
      id: INVOICE.plover,
      workspaceId: WORKSPACE.cedar,
      clientId: CLIENT.plover,
      number: "CL-2202",
      status: "sent",
      issueDate: isoDay(now, -4),
      dueDate: isoDay(now, 14),
      publicToken: PAY.plover,
      lines: [
        line("Case assessment", 1, 480_000),
        line("Motion draft", 8, 80_000),
      ],
      notes: "Contract dispute. Hours through the draft motion only.",
      sentAt: new Date(Date.parse(`${isoDay(now, -3)}T15:00:00.000Z`)).toISOString(),
    }),
    invoice({
      id: INVOICE.ives,
      workspaceId: WORKSPACE.cedar,
      clientId: CLIENT.ives,
      number: "CL-2203",
      status: "overdue",
      issueDate: isoDay(now, -28),
      dueDate: isoDay(now, -9),
      publicToken: PAY.ives,
      lines: [
        line("Entity formation", 1, 180_000),
        line("Operating agreement", 1, 100_000),
      ],
      notes: "Formation package for the new studio entity.",
      sentAt: new Date(Date.parse(`${isoDay(now, -27)}T15:00:00.000Z`)).toISOString(),
      viewedAt: new Date(Date.parse(`${isoDay(now, -20)}T15:00:00.000Z`)).toISOString(),
    }),
    invoice({
      id: INVOICE.redkite,
      workspaceId: WORKSPACE.cedar,
      clientId: CLIENT.redkite,
      number: "CL-2204",
      status: "draft",
      issueDate: isoDay(now, 0),
      dueDate: isoDay(now, 30),
      publicToken: PAY.redkite,
      lines: [line("Monthly counsel retainer", 1, 1_500_000)],
      notes: "Do not send until the engagement letter is countersigned.",
    }),
  ]

  const notifications: Notification[] = [
    {
      id: "e0000001-0000-4000-8000-000000000001",
      workspaceId: WORKSPACE.northwind,
      userId: USER.maya,
      type: "invoice.overdue",
      title: "Fieldnote Coffee is overdue",
      body: "NW-1044 was due 18 days ago and is still open.",
      href: `/invoices/${INVOICE.fieldnote}`,
      invoiceId: INVOICE.fieldnote,
      readAt: null,
      createdAt: new Date(Date.parse(`${isoDay(now, -1)}T15:00:00.000Z`)).toISOString(),
    },
    {
      id: "e0000001-0000-4000-8000-000000000002",
      workspaceId: WORKSPACE.northwind,
      userId: USER.owen,
      type: "invoice.overdue",
      title: "Fieldnote Coffee is overdue",
      body: "NW-1044 was due 18 days ago and is still open.",
      href: `/invoices/${INVOICE.fieldnote}`,
      invoiceId: INVOICE.fieldnote,
      readAt: null,
      createdAt: new Date(Date.parse(`${isoDay(now, -1)}T15:00:00.000Z`)).toISOString(),
    },
    {
      id: "e0000001-0000-4000-8000-000000000003",
      workspaceId: WORKSPACE.cedar,
      userId: USER.leah,
      type: "invoice.viewed",
      title: "Plover Manufacturing has not opened CL-2202",
      body: "The motion invoice is out. No view yet.",
      href: `/invoices/${INVOICE.plover}`,
      invoiceId: INVOICE.plover,
      readAt: null,
      createdAt: new Date(Date.parse(`${isoDay(now, -2)}T15:00:00.000Z`)).toISOString(),
    },
  ]

  const emails: EmailMessage[] = [
    {
      id: "f0000001-0000-4000-8000-000000000001",
      workspaceId: WORKSPACE.northwind,
      to: "priya@harborandco.example",
      subject: "Invoice NW-1042 from Northwind Studio",
      body: "Hi Priya,\n\nInvoice NW-1042 for the identity system is attached in spirit and payable online.\n\nThank you,\nMaya Chen\nNorthwind Studio",
      kind: "invoice",
      createdAt: stamp(now, -5, 2),
    },
    {
      id: "f0000001-0000-4000-8000-000000000002",
      workspaceId: WORKSPACE.northwind,
      to: "hello@fieldnote.example",
      subject: "Invoice NW-1044 is past due",
      body: "Hi June,\n\nA short note that NW-1044 for the winter packaging is past due. The payment link is unchanged.\n\nThank you,\nMaya Chen",
      kind: "overdue",
      createdAt: new Date(Date.parse(`${isoDay(now, -1)}T15:00:00.000Z`)).toISOString(),
    },
  ]

  return {
    users,
    workspaces,
    memberships,
    clients,
    invoices,
    notifications,
    emails,
    tokens: [],
  }
}
