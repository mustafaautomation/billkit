import "server-only"

// Business rules for every Billkit flow. Pages and server actions call these
// functions with an Actor; tenant checks, read-only demo rules, plan limits,
// notifications and outgoing mail all happen here, on top of whichever Store
// (memory or Supabase service role) is active.
//
// NOTE: reconstructed on 25 Nov 2026 from the call sites, the Store interface,
// the domain helpers and the README after the original file was lost in the
// Cursor rescue (see RESCUE_NOTES.md).

import { newSecret } from "@/lib/auth/password"
import { writeReminder, type ReminderDraft } from "@/lib/ai/reminder"
import { ActionError } from "@/lib/data/errors"
import { getStore } from "@/lib/data/get-store"
import type { MembershipWithUser, Store } from "@/lib/data/store"
import { summarize, type DashboardSummary } from "@/lib/domain/metrics"
import {
  addDays,
  computeTotals,
  MoneyError,
  priceInvoice,
  todayISO,
  toDiscount,
} from "@/lib/domain/money"
import { entitlements, TRIAL_DAYS, type Entitlements } from "@/lib/domain/plans"
import type {
  AuthToken,
  Client,
  DiscountType,
  EmailMessage,
  Invoice,
  InvoiceStatus,
  Notification,
  NotificationType,
  PlanId,
  PricedInvoice,
  Role,
  SubscriptionStatus,
  User,
  Workspace,
} from "@/lib/domain/types"
import { authEmail, invoiceEmail, overdueEmail, receiptEmail, viewedEmail } from "@/lib/email/compose"
import { deliverEmail } from "@/lib/email/deliver"

export type Actor =
  | { kind: "demo"; workspaceId: string }
  | {
      kind: "user"
      userId: string
      workspaceId: string
      role: Role
      isSuperAdmin: boolean
    }

type UserActor = Extract<Actor, { kind: "user" }>

export type InvoiceDraft = {
  clientId: string
  issueDate: string
  dueDate: string
  taxPercent: number
  discountType: DiscountType
  discountValue: number
  notes: string
  lines: Array<{ description: string; quantity: number; unitAmountCents: number }>
}

export type InvoiceFilters = {
  status?: string
  clientId?: string
  q?: string
  from?: string
  to?: string
}

const READ_ONLY_MESSAGE = "This is a read-only demo. Create a free workspace to make changes."
const OPEN_STATUSES: InvoiceStatus[] = ["sent", "viewed", "overdue"]
const AUTH_TOKEN_TTL_MS = 60 * 60 * 1000
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// ---------------------------------------------------------------------------
// Helpers

function nowISO() {
  return new Date().toISOString()
}

function today() {
  return todayISO()
}

function price(invoice: Invoice): PricedInvoice {
  return priceInvoice(invoice, today())
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function assertEmail(email: string, label = "Enter a valid email address.") {
  if (!EMAIL_PATTERN.test(email)) throw new ActionError(label)
}

function isValidDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function writable(actor: Actor): UserActor {
  if (actor.kind !== "user") throw new ActionError(READ_ONLY_MESSAGE, "readonly")
  return actor
}

function ownerOnly(actor: Actor, message = "Only the workspace owner can do that."): UserActor {
  const user = writable(actor)
  if (user.role !== "owner") throw new ActionError(message, "forbidden")
  return user
}

function superAdmin(actor: Actor): UserActor {
  if (actor.kind !== "user" || !actor.isSuperAdmin) {
    throw new ActionError("Super admin only.", "forbidden")
  }
  return actor
}

async function scopedWorkspace(store: Store, actor: Actor): Promise<Workspace> {
  const workspace = await store.getWorkspace(actor.workspaceId)
  if (!workspace) throw new ActionError("Workspace not found.", "not_found")
  if (actor.kind === "user") {
    const memberships = await store.listMemberships(workspace.id)
    if (!memberships.some((membership) => membership.userId === actor.userId)) {
      throw new ActionError("Workspace not found.", "not_found")
    }
  }
  return workspace
}

async function scopedInvoiceRecord(store: Store, actor: Actor, id: string): Promise<Invoice> {
  const invoice = id ? await store.getInvoice(id) : null
  if (!invoice || invoice.workspaceId !== actor.workspaceId) {
    throw new ActionError("Invoice not found.", "not_found")
  }
  return invoice
}

async function scopedClientRecord(store: Store, actor: Actor, id: string): Promise<Client> {
  const client = id ? await store.getClient(id) : null
  if (!client || client.workspaceId !== actor.workspaceId) {
    throw new ActionError("Client not found.", "not_found")
  }
  return client
}

async function senderName(store: Store, actor: Actor, workspace: Workspace) {
  if (actor.kind !== "user") return workspace.name
  const user = await store.findUserById(actor.userId)
  return user?.name || workspace.name
}

function payUrl(origin: string, invoice: Invoice) {
  return `${origin}/pay/${invoice.publicToken}`
}

function createdThisMonth(invoices: Invoice[]) {
  const month = today().slice(0, 7)
  return invoices.filter((invoice) => invoice.createdAt.slice(0, 7) === month).length
}

async function notifyMembers(
  store: Store,
  workspaceId: string,
  input: {
    type: NotificationType
    title: string
    body: string
    href: string
    invoiceId?: string | null
  },
) {
  const memberships = await store.listMemberships(workspaceId)
  const createdAt = nowISO()
  for (const membership of memberships) {
    const notification: Notification = {
      id: crypto.randomUUID(),
      workspaceId,
      userId: membership.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      invoiceId: input.invoiceId ?? null,
      readAt: null,
      createdAt,
    }
    await store.insertNotification(notification)
  }
}

function clientLabel(client: Client) {
  return client.company || client.name
}

/**
 * Invoices are overdue by date (see effectiveStatus). When a signed-in member
 * loads the ledger, any sent or viewed invoice that crossed its due date is
 * stored as overdue once, with an in-app notification and a mocked overdue
 * email. The demo surface never writes.
 */
async function sweepOverdue(store: Store, actor: Actor, workspace: Workspace, origin: string) {
  if (actor.kind !== "user") return
  const invoices = await store.listInvoices(workspace.id)
  const due = invoices.filter(
    (invoice) =>
      (invoice.status === "sent" || invoice.status === "viewed") &&
      price(invoice).displayStatus === "overdue",
  )
  if (due.length === 0) return
  const sender = await senderName(store, actor, workspace)
  for (const invoice of due) {
    const updated: Invoice = { ...invoice, status: "overdue", updatedAt: nowISO() }
    await store.updateInvoice(updated)
    const client = await store.getClient(invoice.clientId)
    if (!client) continue
    const priced = price(updated)
    const mail = overdueEmail({ workspace, client, invoice: priced, payUrl: payUrl(origin, invoice), senderName: sender })
    await deliverEmail(store, {
      workspaceId: workspace.id,
      to: client.email,
      subject: mail.subject,
      body: mail.body,
      kind: "overdue",
    })
    await notifyMembers(store, workspace.id, {
      type: "invoice.overdue",
      title: `${clientLabel(client)} is overdue`,
      body: `${invoice.number} was due ${invoice.dueDate} and is still open.`,
      href: `/invoices/${invoice.id}`,
      invoiceId: invoice.id,
    })
  }
}

function sortInvoices(invoices: PricedInvoice[]) {
  return invoices.sort((a, b) => {
    if (a.issueDate !== b.issueDate) return a.issueDate < b.issueDate ? 1 : -1
    return a.number < b.number ? 1 : -1
  })
}

function sortClients(clients: Client[]) {
  return clients.sort((a, b) => clientLabel(a).localeCompare(clientLabel(b)))
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace"
  )
}

function prefixFor(name: string) {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
  const initials = words.map((word) => word[0]).join("").slice(0, 3)
  if (initials.length >= 2) return initials
  const compact = words.join("")
  return (compact.slice(0, 3) || "INV").padEnd(2, "X")
}

// ---------------------------------------------------------------------------
// Auth and accounts

export async function registerUser(input: {
  name: string
  email: string
  password: string
  workspaceName: string
  passwordHash: string
  userId?: string
}): Promise<{ user: User; workspace: Workspace }> {
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  const workspaceName = input.workspaceName.trim()
  if (!name) throw new ActionError("Enter your name.")
  assertEmail(email)
  if (input.password.length < 10) throw new ActionError("Use at least 10 characters.")
  if (!workspaceName) throw new ActionError("Name the workspace.")
  const store = await getStore()
  const existing = await store.findUserByEmail(email)
  if (existing && existing.id !== input.userId) {
    throw new ActionError("An account with that email already exists. Log in instead.")
  }
  const createdAt = nowISO()
  const user: User = {
    id: input.userId ?? crypto.randomUUID(),
    email,
    name,
    passwordHash: input.passwordHash === "supabase" ? null : input.passwordHash,
    isSuperAdmin: false,
    createdAt,
  }
  await store.insertUser(user)

  const base = slugify(workspaceName)
  let slug = base
  while (await store.getWorkspaceBySlug(slug)) {
    slug = `${base}-${newSecret().slice(0, 5).toLowerCase().replace(/[^a-z0-9]/g, "x")}`
  }
  const workspace: Workspace = {
    id: crypto.randomUUID(),
    name: workspaceName,
    slug,
    plan: "starter",
    subscriptionStatus: "trialing",
    trialEndsAt: addDays(today(), TRIAL_DAYS),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    invoicePrefix: prefixFor(workspaceName),
    nextNumber: 1001,
    address: "",
    email,
    createdAt,
  }
  await store.insertWorkspace(workspace, {
    id: crypto.randomUUID(),
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
    createdAt,
  })
  return { user, workspace }
}

export async function updatePassword(userId: string, passwordHash: string) {
  const store = await getStore()
  const user = await store.findUserById(userId)
  if (!user) throw new ActionError("Account not found.", "not_found")
  await store.updateUser({ ...user, passwordHash })
}

export async function issueAuthToken(
  rawEmail: string,
  type: "magic" | "reset",
  origin: string,
): Promise<{ link: string | null }> {
  const email = normalizeEmail(rawEmail)
  assertEmail(email)
  const store = await getStore()
  const user = await store.findUserByEmail(email)
  // Do not reveal whether an account exists.
  if (!user) return { link: null }
  const token: AuthToken = {
    id: crypto.randomUUID(),
    userId: user.id,
    email,
    token: newSecret(),
    type,
    expiresAt: new Date(Date.now() + AUTH_TOKEN_TTL_MS).toISOString(),
    consumedAt: null,
    workspaceId: null,
    role: null,
    createdAt: nowISO(),
  }
  await store.insertToken(token)
  const link =
    type === "magic"
      ? `${origin}/magic/verify?token=${encodeURIComponent(token.token)}`
      : `${origin}/reset-password?token=${encodeURIComponent(token.token)}`
  const mail = authEmail({ kind: type, link })
  const delivered = await deliverEmail(store, {
    workspaceId: null,
    to: email,
    subject: mail.subject,
    body: mail.body,
    kind: "auth",
  })
  // The link is only handed back to the browser while mail is mocked.
  return { link: delivered.channel === "mock" ? link : null }
}

export async function consumeAuthToken(raw: string, type: "magic" | "reset"): Promise<User | null> {
  if (!raw) return null
  const store = await getStore()
  const token = await store.findToken(raw)
  if (!token || token.type !== type || token.consumedAt) return null
  if (Date.parse(token.expiresAt) < Date.now()) return null
  await store.updateToken({ ...token, consumedAt: nowISO() })
  if (token.userId) return store.findUserById(token.userId)
  return store.findUserByEmail(token.email)
}

export async function acceptInvite(user: User, raw: string): Promise<string> {
  const store = await getStore()
  const token = raw ? await store.findToken(raw) : null
  if (!token || token.type !== "invite" || !token.workspaceId) {
    throw new ActionError("This invite link is not valid.", "not_found")
  }
  if (token.consumedAt) throw new ActionError("This invite has already been used.", "invalid")
  if (Date.parse(token.expiresAt) < Date.now()) throw new ActionError("This invite has expired.", "invalid")
  if (normalizeEmail(token.email) !== normalizeEmail(user.email)) {
    throw new ActionError(`This invite was sent to ${token.email}. Sign in with that email.`, "forbidden")
  }
  const workspace = await store.getWorkspace(token.workspaceId)
  if (!workspace) throw new ActionError("That workspace no longer exists.", "not_found")
  const memberships = await store.listMemberships(workspace.id)
  if (!memberships.some((membership) => membership.userId === user.id)) {
    const rights = entitlements(workspace, today())
    if (memberships.length >= rights.seatLimit) {
      throw new ActionError(`${workspace.name} has no free seats on ${rights.label}.`, "limit")
    }
    await store.insertMembership({
      id: crypto.randomUUID(),
      workspaceId: workspace.id,
      userId: user.id,
      role: token.role ?? "member",
      createdAt: nowISO(),
    })
    await notifyMembers(store, workspace.id, {
      type: "team",
      title: `${user.name} joined ${workspace.name}`,
      body: `${user.email} accepted the invite.`,
      href: "/settings/team",
    })
  }
  await store.updateToken({ ...token, consumedAt: nowISO() })
  return workspace.id
}

// ---------------------------------------------------------------------------
// Public invoice page and payments

export async function openPublicInvoice(
  token: string,
  origin: string,
): Promise<{ invoice: PricedInvoice; client: Client; workspace: Workspace }> {
  void origin
  const store = await getStore()
  let invoice = token ? await store.getInvoiceByToken(token) : null
  if (!invoice || invoice.status === "draft") throw new ActionError("Invoice not found.", "not_found")
  const [client, workspace] = await Promise.all([
    store.getClient(invoice.clientId),
    store.getWorkspace(invoice.workspaceId),
  ])
  if (!client || !workspace) throw new ActionError("Invoice not found.", "not_found")

  // First open by the client: record the view.
  if (!invoice.viewedAt && (invoice.status === "sent" || invoice.status === "overdue")) {
    const viewedAt = nowISO()
    invoice = {
      ...invoice,
      status: invoice.status === "sent" ? "viewed" : invoice.status,
      viewedAt,
      updatedAt: viewedAt,
    }
    await store.updateInvoice(invoice)
    const priced = price(invoice)
    const mail = viewedEmail({ workspace, invoice: priced, client })
    await deliverEmail(store, {
      workspaceId: workspace.id,
      to: workspace.email,
      subject: mail.subject,
      body: mail.body,
      kind: "viewed",
    })
    await notifyMembers(store, workspace.id, {
      type: "invoice.viewed",
      title: `${clientLabel(client)} viewed ${invoice.number}`,
      body: "The client opened the payment page. No payment has been recorded yet.",
      href: `/invoices/${invoice.id}`,
      invoiceId: invoice.id,
    })
  }
  return { invoice: price(invoice), client, workspace }
}

export async function recordPayment(token: string, amountCents?: number): Promise<PricedInvoice> {
  const store = await getStore()
  const invoice = token ? await store.getInvoiceByToken(token) : null
  if (!invoice) throw new ActionError("Invoice not found.", "not_found")
  if (invoice.status === "paid") return price(invoice)
  if (invoice.status === "draft" || invoice.status === "void") {
    throw new ActionError("This invoice cannot be paid.")
  }
  const priced = price(invoice)
  if (amountCents !== undefined && amountCents !== priced.totalCents) {
    throw new ActionError("The payment amount does not match the invoice total.")
  }
  const paidAt = nowISO()
  const updated: Invoice = { ...invoice, status: "paid", paidAt, updatedAt: paidAt }
  await store.updateInvoice(updated)
  const [client, workspace] = await Promise.all([
    store.getClient(invoice.clientId),
    store.getWorkspace(invoice.workspaceId),
  ])
  const result = price(updated)
  if (client && workspace) {
    const mail = receiptEmail({ workspace, client, invoice: result })
    await deliverEmail(store, {
      workspaceId: workspace.id,
      to: client.email,
      subject: mail.subject,
      body: mail.body,
      kind: "billing",
    })
    await notifyMembers(store, workspace.id, {
      type: "invoice.paid",
      title: `${clientLabel(client)} paid ${invoice.number}`,
      body: `Payment recorded for ${invoice.number}.`,
      href: `/invoices/${invoice.id}`,
      invoiceId: invoice.id,
    })
  }
  return result
}

export async function invoicePdfSource(
  id: string,
  token: string | null,
  actor: Actor | null,
): Promise<{ workspace: Workspace; client: Client; invoice: PricedInvoice; branded: boolean } | null> {
  const store = await getStore()
  const invoice = id ? await store.getInvoice(id) : null
  if (!invoice) return null
  if (token) {
    if (invoice.publicToken !== token) return null
  } else if (!actor || actor.kind !== "user" || actor.workspaceId !== invoice.workspaceId) {
    return null
  }
  const [client, workspace] = await Promise.all([
    store.getClient(invoice.clientId),
    store.getWorkspace(invoice.workspaceId),
  ])
  if (!client || !workspace) return null
  return {
    workspace,
    client,
    invoice: price(invoice),
    branded: !entitlements(workspace, today()).removeBranding,
  }
}

// ---------------------------------------------------------------------------
// Reads for the app and demo surfaces

export async function loadDashboard(
  actor: Actor,
  origin: string,
): Promise<{ workspace: Workspace; clients: Client[]; summary: DashboardSummary; recent: PricedInvoice[] }> {
  const store = await getStore()
  const workspace = await scopedWorkspace(store, actor)
  await sweepOverdue(store, actor, workspace, origin)
  const [invoices, clients] = await Promise.all([
    store.listInvoices(workspace.id),
    store.listClients(workspace.id),
  ])
  const priced = invoices.map(price)
  const recent = [...priced]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.number < b.number ? 1 : -1))
    .slice(0, 6)
  return { workspace, clients, summary: summarize(priced, today()), recent }
}

export async function listWorkspaceInvoices(
  actor: Actor,
  origin: string,
  filters: InvoiceFilters = {},
): Promise<{ invoices: PricedInvoice[]; clients: Client[] }> {
  const store = await getStore()
  const workspace = await scopedWorkspace(store, actor)
  await sweepOverdue(store, actor, workspace, origin)
  const [invoices, clients] = await Promise.all([
    store.listInvoices(workspace.id),
    store.listClients(workspace.id),
  ])
  const byId = new Map(clients.map((client) => [client.id, client]))
  const status = filters.status && filters.status !== "any" ? filters.status : null
  const q = filters.q?.trim().toLowerCase() ?? ""
  const from = filters.from && isValidDate(filters.from) ? filters.from : null
  const to = filters.to && isValidDate(filters.to) ? filters.to : null
  const rows = invoices.map(price).filter((invoice) => {
    if (status && invoice.displayStatus !== status) return false
    if (filters.clientId && invoice.clientId !== filters.clientId) return false
    if (from && invoice.issueDate < from) return false
    if (to && invoice.issueDate > to) return false
    if (q) {
      const client = byId.get(invoice.clientId)
      const haystack = [invoice.number, client?.name, client?.company, client?.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
  return { invoices: sortInvoices(rows), clients: sortClients(clients) }
}

export async function getScopedInvoice(
  actor: Actor,
  id: string,
): Promise<{ invoice: PricedInvoice; client: Client; workspace: Workspace }> {
  const store = await getStore()
  const workspace = await scopedWorkspace(store, actor)
  const invoice = await scopedInvoiceRecord(store, actor, id)
  const client = await store.getClient(invoice.clientId)
  if (!client) throw new ActionError("Invoice not found.", "not_found")
  return { invoice: price(invoice), client, workspace }
}

export async function listWorkspaceClients(
  actor: Actor,
  query: string,
): Promise<{ clients: Client[]; counts: Map<string, number> }> {
  const store = await getStore()
  const workspace = await scopedWorkspace(store, actor)
  const [clients, invoices] = await Promise.all([
    store.listClients(workspace.id),
    store.listInvoices(workspace.id),
  ])
  const counts = new Map<string, number>()
  for (const invoice of invoices) counts.set(invoice.clientId, (counts.get(invoice.clientId) ?? 0) + 1)
  const q = query.trim().toLowerCase()
  const filtered = q
    ? clients.filter((client) =>
        [client.name, client.company, client.email].join(" ").toLowerCase().includes(q),
      )
    : clients
  return { clients: sortClients(filtered), counts }
}

export async function getScopedClient(
  actor: Actor,
  id: string,
): Promise<{ client: Client; invoices: PricedInvoice[] }> {
  const store = await getStore()
  await scopedWorkspace(store, actor)
  const client = await scopedClientRecord(store, actor, id)
  const invoices = (await store.listInvoices(actor.workspaceId))
    .filter((invoice) => invoice.clientId === client.id)
    .map(price)
  return { client, invoices: sortInvoices(invoices) }
}

export async function loadBilling(
  actor: Actor,
): Promise<{ workspace: Workspace; entitlements: Entitlements; used: number }> {
  const store = await getStore()
  const workspace = await scopedWorkspace(store, actor)
  const invoices = await store.listInvoices(workspace.id)
  return { workspace, entitlements: entitlements(workspace, today()), used: createdThisMonth(invoices) }
}

export async function loadTeam(
  actor: Actor,
): Promise<{ workspace: Workspace; members: MembershipWithUser[]; entitlements: Entitlements }> {
  const store = await getStore()
  const workspace = await scopedWorkspace(store, actor)
  const members = await store.listMembers(workspace.id)
  members.sort((a, b) => {
    if (a.role !== b.role) return a.role === "owner" ? -1 : 1
    return a.user.name.localeCompare(b.user.name)
  })
  return { workspace, members, entitlements: entitlements(workspace, today()) }
}

export async function loadInbox(actor: Actor): Promise<EmailMessage[]> {
  const store = await getStore()
  const workspace = await scopedWorkspace(store, actor)
  if (actor.kind !== "user") return store.listEmails(workspace.id, "")
  const user = await store.findUserById(actor.userId)
  return store.listEmails(workspace.id, user?.email ?? "")
}

async function notificationOwner(store: Store, actor: Actor): Promise<string | null> {
  if (actor.kind === "user") return actor.userId
  const members = await store.listMembers(actor.workspaceId)
  return members.find((member) => member.role === "owner")?.userId ?? null
}

export async function loadNotifications(actor: Actor): Promise<Notification[]> {
  const store = await getStore()
  await scopedWorkspace(store, actor)
  const userId = await notificationOwner(store, actor)
  if (!userId) return []
  return store.listNotifications(userId, actor.workspaceId)
}

export async function readNotifications(actor: Actor) {
  const user = writable(actor)
  const store = await getStore()
  await scopedWorkspace(store, user)
  await store.markAllNotificationsRead(user.userId, user.workspaceId)
}

// ---------------------------------------------------------------------------
// Clients

export async function saveClient(
  actor: Actor,
  input: { id?: string; name: string; email: string; company: string; address: string; notes: string },
): Promise<Client> {
  const user = writable(actor)
  const store = await getStore()
  const workspace = await scopedWorkspace(store, user)
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  if (!name) throw new ActionError("Enter the client's name.")
  assertEmail(email, "Enter a valid client email.")
  const fields = {
    name,
    email,
    company: input.company.trim() || name,
    address: input.address.trim(),
    notes: input.notes.trim(),
  }
  if (input.id) {
    const existing = await scopedClientRecord(store, user, input.id)
    const updated: Client = { ...existing, ...fields }
    await store.updateClient(updated)
    return updated
  }
  const client: Client = {
    id: crypto.randomUUID(),
    workspaceId: workspace.id,
    ...fields,
    createdAt: nowISO(),
  }
  await store.insertClient(client)
  return client
}

export async function removeClient(actor: Actor, id: string) {
  const user = writable(actor)
  const store = await getStore()
  await scopedWorkspace(store, user)
  const client = await scopedClientRecord(store, user, id)
  const invoices = (await store.listInvoices(user.workspaceId)).filter((invoice) => invoice.clientId === client.id)
  if (invoices.length > 0) {
    throw new ActionError("This client has invoices. Void them instead of deleting the client.")
  }
  await store.deleteClient(client.id)
}

// ---------------------------------------------------------------------------
// Invoices

function validateDraft(draft: InvoiceDraft) {
  if (!draft.clientId) throw new ActionError("Choose a client.")
  if (!isValidDate(draft.issueDate)) throw new ActionError("Enter a valid issue date.")
  if (!isValidDate(draft.dueDate)) throw new ActionError("Enter a valid due date.")
  if (draft.dueDate < draft.issueDate) throw new ActionError("The due date cannot be before the issue date.")
  const lines = draft.lines.filter(
    (line) => line.description.trim() || line.unitAmountCents > 0 || (line.quantity && line.quantity !== 1),
  )
  if (lines.length === 0) throw new ActionError("Add at least one line item.")
  for (const line of lines) {
    if (!line.description.trim()) throw new ActionError("Each line needs a description.")
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new ActionError("Quantities must be greater than zero.")
    }
    if (!Number.isInteger(line.unitAmountCents) || line.unitAmountCents < 0) {
      throw new ActionError("Enter a rate for each line.")
    }
  }
  if (!Number.isFinite(draft.taxPercent) || draft.taxPercent < 0 || draft.taxPercent > 100) {
    throw new ActionError("Tax must be between 0 and 100 percent.")
  }
  const taxRateBps = Math.round(draft.taxPercent * 100)
  const discountValue = draft.discountType === "none" ? 0 : draft.discountValue
  if (!Number.isFinite(discountValue) || discountValue < 0) {
    throw new ActionError("The discount cannot be negative.")
  }
  if (draft.discountType === "percent" && discountValue > 10000) {
    throw new ActionError("A percent discount cannot exceed 100%.")
  }
  const record = {
    lines: lines.map((line) => ({
      id: crypto.randomUUID(),
      description: line.description.trim(),
      quantity: line.quantity,
      unitAmountCents: line.unitAmountCents,
    })),
    taxRateBps,
    discountType: draft.discountType,
    discountValue,
  }
  try {
    computeTotals({ lines: record.lines, discount: toDiscount(record), taxRateBps })
  } catch (error) {
    if (error instanceof MoneyError) throw new ActionError(error.message)
    throw error
  }
  return record
}

export async function createOrUpdateInvoice(
  actor: Actor,
  draft: InvoiceDraft,
  existingId?: string,
): Promise<Invoice> {
  const user = writable(actor)
  const store = await getStore()
  const workspace = await scopedWorkspace(store, user)
  const record = validateDraft(draft)
  await scopedClientRecord(store, user, draft.clientId)
  const updatedAt = nowISO()

  if (existingId) {
    const existing = await scopedInvoiceRecord(store, user, existingId)
    if (existing.status !== "draft") throw new ActionError("Only drafts can be edited.")
    const updated: Invoice = {
      ...existing,
      ...record,
      clientId: draft.clientId,
      issueDate: draft.issueDate,
      dueDate: draft.dueDate,
      notes: draft.notes.trim(),
      updatedAt,
    }
    await store.updateInvoice(updated)
    return updated
  }

  const rights = entitlements(workspace, today())
  if (rights.invoiceLimit !== null) {
    const used = createdThisMonth(await store.listInvoices(workspace.id))
    if (used >= rights.invoiceLimit) {
      throw new ActionError(
        `${rights.label} includes ${rights.invoiceLimit} invoices a month. Upgrade to Pro for more.`,
        "limit",
      )
    }
  }
  const invoice: Invoice = {
    id: crypto.randomUUID(),
    workspaceId: workspace.id,
    clientId: draft.clientId,
    number: `${workspace.invoicePrefix}-${workspace.nextNumber}`,
    status: "draft",
    issueDate: draft.issueDate,
    dueDate: draft.dueDate,
    currency: "USD",
    ...record,
    notes: draft.notes.trim(),
    publicToken: `pay_${newSecret()}`,
    sentAt: null,
    viewedAt: null,
    paidAt: null,
    voidedAt: null,
    createdAt: updatedAt,
    updatedAt,
  }
  await store.updateWorkspace({ ...workspace, nextNumber: workspace.nextNumber + 1 })
  await store.insertInvoice(invoice)
  return invoice
}

export async function sendInvoice(actor: Actor, id: string, origin: string): Promise<PricedInvoice> {
  const user = writable(actor)
  const store = await getStore()
  const workspace = await scopedWorkspace(store, user)
  const invoice = await scopedInvoiceRecord(store, user, id)
  if (invoice.status !== "draft") throw new ActionError("Only drafts can be sent.")
  const client = await scopedClientRecord(store, user, invoice.clientId)
  const sentAt = nowISO()
  const updated: Invoice = { ...invoice, status: "sent", sentAt, updatedAt: sentAt }
  await store.updateInvoice(updated)
  const priced = price(updated)
  const mail = invoiceEmail({
    workspace,
    client,
    invoice: priced,
    payUrl: payUrl(origin, updated),
    senderName: await senderName(store, user, workspace),
  })
  await deliverEmail(store, {
    workspaceId: workspace.id,
    to: client.email,
    subject: mail.subject,
    body: mail.body,
    kind: "invoice",
  })
  await notifyMembers(store, workspace.id, {
    type: "invoice.sent",
    title: `${invoice.number} sent to ${clientLabel(client)}`,
    body: `Emailed to ${client.email}. Due ${invoice.dueDate}.`,
    href: `/invoices/${invoice.id}`,
    invoiceId: invoice.id,
  })
  return priced
}

export async function voidInvoice(actor: Actor, id: string): Promise<PricedInvoice> {
  const user = writable(actor)
  const store = await getStore()
  await scopedWorkspace(store, user)
  const invoice = await scopedInvoiceRecord(store, user, id)
  if (invoice.status === "void") return price(invoice)
  if (invoice.status === "paid") throw new ActionError("Paid invoices cannot be voided.")
  const voidedAt = nowISO()
  const updated: Invoice = { ...invoice, status: "void", voidedAt, updatedAt: voidedAt }
  await store.updateInvoice(updated)
  return price(updated)
}

async function reminderContext(store: Store, actor: UserActor, id: string) {
  const workspace = await scopedWorkspace(store, actor)
  const invoice = price(await scopedInvoiceRecord(store, actor, id))
  if (!OPEN_STATUSES.includes(invoice.displayStatus)) {
    throw new ActionError("Reminders are only for sent, viewed, or overdue invoices.")
  }
  const client = await scopedClientRecord(store, actor, invoice.clientId)
  return { workspace, invoice, client }
}

export async function draftReminder(actor: Actor, id: string, origin: string): Promise<ReminderDraft> {
  const user = writable(actor)
  const store = await getStore()
  const { workspace, invoice, client } = await reminderContext(store, user, id)
  return writeReminder({
    workspace,
    client,
    invoice,
    payUrl: payUrl(origin, invoice),
    senderName: await senderName(store, user, workspace),
  })
}

export async function sendReminder(actor: Actor, id: string, body: string, origin: string) {
  const user = writable(actor)
  const text = body.trim()
  if (!text) throw new ActionError("Write the reminder before sending it.")
  const store = await getStore()
  const { workspace, invoice, client } = await reminderContext(store, user, id)
  const url = payUrl(origin, invoice)
  await deliverEmail(store, {
    workspaceId: workspace.id,
    to: client.email,
    subject: `Reminder: invoice ${invoice.number} from ${workspace.name}`,
    body: text.includes(url) ? text : `${text}\n\n${url}`,
    kind: "reminder",
  })
}

// ---------------------------------------------------------------------------
// Workspace settings and team

export async function updateWorkspaceProfile(
  actor: Actor,
  input: { name: string; email: string; address: string; invoicePrefix: string },
): Promise<Workspace> {
  const user = ownerOnly(actor, "Only the owner can change the workspace profile.")
  const store = await getStore()
  const workspace = await scopedWorkspace(store, user)
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  const invoicePrefix = input.invoicePrefix.trim().toUpperCase()
  if (!name) throw new ActionError("Name the workspace.")
  assertEmail(email, "Enter a valid billing email.")
  if (!/^[A-Z0-9]{2,6}$/.test(invoicePrefix)) {
    throw new ActionError("The invoice prefix must be 2 to 6 letters or numbers.")
  }
  const updated: Workspace = { ...workspace, name, email, address: input.address.trim(), invoicePrefix }
  await store.updateWorkspace(updated)
  return updated
}

export async function inviteMember(
  actor: Actor,
  rawEmail: string,
  origin: string,
): Promise<{ pending: true; mockLink: string } | { pending: false }> {
  const user = ownerOnly(actor, "Only the owner can invite people.")
  const email = normalizeEmail(rawEmail)
  assertEmail(email)
  const store = await getStore()
  const workspace = await scopedWorkspace(store, user)
  const members = await store.listMembers(workspace.id)
  if (members.some((member) => normalizeEmail(member.user.email) === email)) {
    throw new ActionError("That person is already in this workspace.")
  }
  const rights = entitlements(workspace, today())
  if (members.length >= rights.seatLimit) {
    throw new ActionError(`${rights.label} includes ${rights.seatLimit} seats. Upgrade to add more people.`, "limit")
  }
  const existing = await store.findUserByEmail(email)
  if (existing) {
    await store.insertMembership({
      id: crypto.randomUUID(),
      workspaceId: workspace.id,
      userId: existing.id,
      role: "member",
      createdAt: nowISO(),
    })
    await notifyMembers(store, workspace.id, {
      type: "team",
      title: `${existing.name} joined ${workspace.name}`,
      body: `${existing.email} was added as a member.`,
      href: "/settings/team",
    })
    return { pending: false }
  }
  const token: AuthToken = {
    id: crypto.randomUUID(),
    userId: null,
    email,
    token: newSecret(),
    type: "invite",
    expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    consumedAt: null,
    workspaceId: workspace.id,
    role: "member",
    createdAt: nowISO(),
  }
  await store.insertToken(token)
  const link = `${origin}/invite?token=${encodeURIComponent(token.token)}`
  const inviter = await senderName(store, user, workspace)
  await deliverEmail(store, {
    workspaceId: workspace.id,
    to: email,
    subject: `${inviter} invited you to ${workspace.name} on Billkit`,
    body: `${inviter} invited you to join ${workspace.name} on Billkit.\n\nAccept the invite here:\n${link}\n\nThe link expires in seven days.`,
    kind: "auth",
  })
  return { pending: true, mockLink: link }
}

export async function removeMember(actor: Actor, membershipId: string) {
  const user = ownerOnly(actor, "Only the owner can remove people.")
  const store = await getStore()
  await scopedWorkspace(store, user)
  const memberships = await store.listMemberships(user.workspaceId)
  const membership = memberships.find((item) => item.id === membershipId)
  if (!membership) throw new ActionError("Member not found.", "not_found")
  if (membership.role === "owner") throw new ActionError("The owner cannot be removed.", "forbidden")
  await store.deleteMembership(membership.id)
}

// ---------------------------------------------------------------------------
// Tenant billing

type SubscriptionPatch = {
  plan: PlanId
  subscriptionStatus: SubscriptionStatus
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
  clearTrial?: boolean
}

/** Called by the Stripe webhook after the signature check. */
export async function setSubscription(workspaceId: string, patch: SubscriptionPatch): Promise<Workspace> {
  const store = await getStore()
  const workspace = await store.getWorkspace(workspaceId)
  if (!workspace) throw new ActionError("Workspace not found.", "not_found")
  const updated: Workspace = {
    ...workspace,
    plan: patch.plan,
    subscriptionStatus: patch.subscriptionStatus,
    stripeCustomerId: patch.stripeCustomerId !== undefined ? patch.stripeCustomerId : workspace.stripeCustomerId,
    stripeSubscriptionId:
      patch.stripeSubscriptionId !== undefined ? patch.stripeSubscriptionId : workspace.stripeSubscriptionId,
    cancelAtPeriodEnd: patch.cancelAtPeriodEnd,
    currentPeriodEnd: patch.currentPeriodEnd ?? workspace.currentPeriodEnd,
    trialEndsAt: patch.clearTrial ? null : workspace.trialEndsAt,
  }
  await store.updateWorkspace(updated)
  return updated
}

async function billingNotice(store: Store, workspace: Workspace, title: string, body: string) {
  await deliverEmail(store, {
    workspaceId: workspace.id,
    to: workspace.email,
    subject: title,
    body,
    kind: "billing",
  })
  await notifyMembers(store, workspace.id, { type: "billing", title, body, href: "/settings/billing" })
}

/** Plan change without Stripe: simulated, nothing is charged. */
export async function mockChangePlan(actor: Actor, plan: PlanId): Promise<Workspace> {
  const user = ownerOnly(actor, "Billing is limited to the workspace owner.")
  const store = await getStore()
  const workspace = await scopedWorkspace(store, user)
  const updated: Workspace = {
    ...workspace,
    plan,
    subscriptionStatus: "active",
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: `${addDays(today(), 30)}T00:00:00.000Z`,
  }
  await store.updateWorkspace(updated)
  const name = plan === "pro" ? "Pro" : "Starter"
  await billingNotice(store, updated, `${updated.name} is on ${name}`, `The workspace plan changed to ${name}. This was a mock change; nothing was charged.`)
  return updated
}

export async function mockCancel(actor: Actor): Promise<Workspace> {
  const user = ownerOnly(actor, "Billing is limited to the workspace owner.")
  const store = await getStore()
  const workspace = await scopedWorkspace(store, user)
  const trialing = workspace.subscriptionStatus === "trialing"
  const updated: Workspace = trialing
    ? {
        ...workspace,
        plan: "starter",
        subscriptionStatus: "canceled",
        trialEndsAt: null,
        cancelAtPeriodEnd: false,
      }
    : {
        ...workspace,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: workspace.currentPeriodEnd ?? `${addDays(today(), 30)}T00:00:00.000Z`,
      }
  await store.updateWorkspace(updated)
  await billingNotice(
    store,
    updated,
    `${updated.name} subscription canceled`,
    trialing
      ? "The Pro trial ended early. The workspace is back on Starter limits."
      : `The subscription cancels at the end of the period (${updated.currentPeriodEnd?.slice(0, 10)}).`,
  )
  return updated
}

// ---------------------------------------------------------------------------
// Super admin

export async function adminUsage(actor: Actor): Promise<
  Array<{
    workspace: Workspace
    label: string
    members: number
    invoices: number
    outstandingCents: number
    paidThisMonthCents: number
  }>
> {
  superAdmin(actor)
  const store = await getStore()
  const [workspaces, invoices] = await Promise.all([store.listAllWorkspaces(), store.listAllInvoices()])
  const day = today()
  const rows = []
  for (const workspace of workspaces) {
    const own = invoices.filter((invoice) => invoice.workspaceId === workspace.id).map(price)
    const summary = summarize(own, day)
    const members = await store.listMemberships(workspace.id)
    rows.push({
      workspace,
      label: entitlements(workspace, day).label,
      members: members.length,
      invoices: own.length,
      outstandingCents: summary.outstandingCents,
      paidThisMonthCents: summary.paidThisMonthCents,
    })
  }
  return rows.sort((a, b) => a.workspace.name.localeCompare(b.workspace.name))
}

export async function adminSetPlan(actor: Actor, workspaceId: string, plan: PlanId): Promise<Workspace> {
  superAdmin(actor)
  const store = await getStore()
  const workspace = await store.getWorkspace(workspaceId)
  if (!workspace) throw new ActionError("Workspace not found.", "not_found")
  const updated: Workspace = {
    ...workspace,
    plan,
    subscriptionStatus: "active",
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: workspace.currentPeriodEnd ?? `${addDays(today(), 30)}T00:00:00.000Z`,
  }
  await store.updateWorkspace(updated)
  return updated
}
