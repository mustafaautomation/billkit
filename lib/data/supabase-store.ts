import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { ActionError } from "@/lib/data/errors"
import type { Store } from "@/lib/data/store"
import { supabaseServiceKey, supabaseUrl } from "@/lib/env"
import type {
  AuthToken,
  Client,
  DiscountType,
  EmailMessage,
  Invoice,
  InvoiceLine,
  InvoiceStatus,
  Membership,
  Notification,
  PlanId,
  Role,
  SubscriptionStatus,
  User,
  Workspace,
} from "@/lib/domain/types"

function admin(): SupabaseClient {
  const url = supabaseUrl()
  const key = supabaseServiceKey()
  if (!url || !key) throw new ActionError("Supabase service role key is not configured.")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function fail(error: { message: string } | null) {
  if (error) throw new ActionError(error.message)
}

function asUser(row: { id: string; email: string; name: string; created_at: string }): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: null,
    isSuperAdmin: false,
    createdAt: row.created_at,
  }
}

function asWorkspace(row: Record<string, unknown>): Workspace {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    plan: row.plan as PlanId,
    subscriptionStatus: row.subscription_status as SubscriptionStatus,
    trialEndsAt: row.trial_ends_at ? String(row.trial_ends_at) : null,
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    stripeSubscriptionId: (row.stripe_subscription_id as string | null) ?? null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    currentPeriodEnd: row.current_period_end ? String(row.current_period_end) : null,
    invoicePrefix: String(row.invoice_prefix),
    nextNumber: Number(row.next_number),
    address: String(row.address ?? ""),
    email: String(row.email),
    createdAt: String(row.created_at),
  }
}

function workspaceRow(workspace: Workspace) {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    plan: workspace.plan,
    subscription_status: workspace.subscriptionStatus,
    trial_ends_at: workspace.trialEndsAt,
    stripe_customer_id: workspace.stripeCustomerId,
    stripe_subscription_id: workspace.stripeSubscriptionId,
    cancel_at_period_end: workspace.cancelAtPeriodEnd,
    current_period_end: workspace.currentPeriodEnd,
    invoice_prefix: workspace.invoicePrefix,
    next_number: workspace.nextNumber,
    address: workspace.address,
    email: workspace.email,
    created_at: workspace.createdAt,
  }
}

function asMembership(row: Record<string, unknown>): Membership {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    userId: String(row.user_id),
    role: row.role as Role,
    createdAt: String(row.created_at),
  }
}

function asClient(row: Record<string, unknown>): Client {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    email: String(row.email),
    company: String(row.company),
    address: String(row.address ?? ""),
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at),
  }
}

function linesFrom(rows: Record<string, unknown>[]): InvoiceLine[] {
  return [...rows]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((row) => ({
      id: String(row.id),
      description: String(row.description),
      quantity: Number(row.quantity),
      unitAmountCents: Number(row.unit_amount_cents),
    }))
}

function asInvoice(row: Record<string, unknown>, lines: InvoiceLine[]): Invoice {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    clientId: String(row.client_id),
    number: String(row.number),
    status: row.status as InvoiceStatus,
    issueDate: String(row.issue_date).slice(0, 10),
    dueDate: String(row.due_date).slice(0, 10),
    currency: "USD",
    taxRateBps: Number(row.tax_rate_bps),
    discountType: row.discount_type as DiscountType,
    discountValue: Number(row.discount_value),
    notes: String(row.notes ?? ""),
    publicToken: String(row.public_token),
    lines,
    sentAt: row.sent_at ? String(row.sent_at) : null,
    viewedAt: row.viewed_at ? String(row.viewed_at) : null,
    paidAt: row.paid_at ? String(row.paid_at) : null,
    voidedAt: row.voided_at ? String(row.voided_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function invoiceRow(invoice: Invoice) {
  return {
    id: invoice.id,
    workspace_id: invoice.workspaceId,
    client_id: invoice.clientId,
    number: invoice.number,
    status: invoice.status,
    issue_date: invoice.issueDate,
    due_date: invoice.dueDate,
    currency: invoice.currency,
    tax_rate_bps: invoice.taxRateBps,
    discount_type: invoice.discountType,
    discount_value: invoice.discountValue,
    notes: invoice.notes,
    public_token: invoice.publicToken,
    sent_at: invoice.sentAt,
    viewed_at: invoice.viewedAt,
    paid_at: invoice.paidAt,
    voided_at: invoice.voidedAt,
    created_at: invoice.createdAt,
    updated_at: invoice.updatedAt,
  }
}

async function attachLines(client: SupabaseClient, rows: Record<string, unknown>[]): Promise<Invoice[]> {
  if (rows.length === 0) return []
  const ids = rows.map((row) => String(row.id))
  const lines = await client.from("invoice_lines").select("*").in("invoice_id", ids)
  fail(lines.error)
  const grouped = new Map<string, Record<string, unknown>[]>()
  for (const line of (lines.data ?? []) as Record<string, unknown>[]) {
    const key = String(line.invoice_id)
    grouped.set(key, [...(grouped.get(key) ?? []), line])
  }
  return rows.map((row) => asInvoice(row, linesFrom(grouped.get(String(row.id)) ?? [])))
}

async function replaceLines(client: SupabaseClient, invoice: Invoice) {
  const deleted = await client.from("invoice_lines").delete().eq("invoice_id", invoice.id)
  fail(deleted.error)
  if (invoice.lines.length === 0) return
  const inserted = await client.from("invoice_lines").insert(
    invoice.lines.map((line, position) => ({
      id: line.id,
      invoice_id: invoice.id,
      description: line.description,
      quantity: line.quantity,
      unit_amount_cents: line.unitAmountCents,
      position,
    })),
  )
  fail(inserted.error)
}

function asNotification(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    userId: String(row.user_id),
    type: row.type as Notification["type"],
    title: String(row.title),
    body: String(row.body),
    href: String(row.href),
    invoiceId: row.invoice_id ? String(row.invoice_id) : null,
    readAt: row.read_at ? String(row.read_at) : null,
    createdAt: String(row.created_at),
  }
}

function asEmail(row: Record<string, unknown>): EmailMessage {
  return {
    id: String(row.id),
    workspaceId: row.workspace_id ? String(row.workspace_id) : null,
    to: String(row.to_email),
    subject: String(row.subject),
    body: String(row.body),
    kind: row.kind as EmailMessage["kind"],
    createdAt: String(row.created_at),
  }
}

function asToken(row: Record<string, unknown>): AuthToken {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    email: String(row.email),
    token: String(row.token),
    type: row.type as AuthToken["type"],
    expiresAt: String(row.expires_at),
    consumedAt: row.consumed_at ? String(row.consumed_at) : null,
    workspaceId: row.workspace_id ? String(row.workspace_id) : null,
    role: (row.role as Role | null) ?? null,
    createdAt: String(row.created_at),
  }
}

export function createSupabaseStore(): Store {
  const client = admin()
  return {
    async findUserByEmail(email) {
      const result = await client.from("profiles").select("*").ilike("email", email).maybeSingle()
      fail(result.error)
      return result.data ? asUser(result.data) : null
    },
    async findUserById(id) {
      const result = await client.from("profiles").select("*").eq("id", id).maybeSingle()
      fail(result.error)
      return result.data ? asUser(result.data) : null
    },
    async insertUser(user) {
      fail(
        (
          await client.from("profiles").upsert({
            id: user.id,
            email: user.email,
            name: user.name,
            created_at: user.createdAt,
          })
        ).error,
      )
    },
    async updateUser(user) {
      fail((await client.from("profiles").update({ name: user.name, email: user.email }).eq("id", user.id)).error)
    },
    async listWorkspacesForUser(userId) {
      const memberships = await client.from("memberships").select("*").eq("user_id", userId)
      fail(memberships.error)
      const rows = (memberships.data ?? []) as Record<string, unknown>[]
      const ids = rows.map((row) => String(row.workspace_id))
      if (ids.length === 0) return []
      const workspaces = await client.from("workspaces").select("*").in("id", ids)
      fail(workspaces.error)
      const byId = new Map(
        ((workspaces.data ?? []) as Record<string, unknown>[]).map((row) => [String(row.id), asWorkspace(row)]),
      )
      return rows.flatMap((row) => {
        const workspace = byId.get(String(row.workspace_id))
        return workspace ? [{ workspace, role: row.role as Role }] : []
      })
    },
    async getWorkspace(id) {
      const result = await client.from("workspaces").select("*").eq("id", id).maybeSingle()
      fail(result.error)
      return result.data ? asWorkspace(result.data) : null
    },
    async getWorkspaceBySlug(slug) {
      const result = await client.from("workspaces").select("*").eq("slug", slug).maybeSingle()
      fail(result.error)
      return result.data ? asWorkspace(result.data) : null
    },
    async insertWorkspace(workspace, membership) {
      fail((await client.from("workspaces").insert(workspaceRow(workspace))).error)
      fail(
        (
          await client.from("memberships").insert({
            id: membership.id,
            workspace_id: membership.workspaceId,
            user_id: membership.userId,
            role: membership.role,
            created_at: membership.createdAt,
          })
        ).error,
      )
    },
    async updateWorkspace(workspace) {
      fail((await client.from("workspaces").update(workspaceRow(workspace)).eq("id", workspace.id)).error)
    },
    async listAllWorkspaces() {
      const result = await client.from("workspaces").select("*")
      fail(result.error)
      return ((result.data ?? []) as Record<string, unknown>[]).map(asWorkspace)
    },
    async listMembers(workspaceId) {
      const memberships = await client.from("memberships").select("*").eq("workspace_id", workspaceId)
      fail(memberships.error)
      const rows = (memberships.data ?? []) as Record<string, unknown>[]
      const ids = rows.map((row) => String(row.user_id))
      if (ids.length === 0) return []
      const users = await client.from("profiles").select("*").in("id", ids)
      fail(users.error)
      const byId = new Map(((users.data ?? []) as { id: string; email: string; name: string; created_at: string }[]).map((row) => [row.id, asUser(row)]))
      return rows.flatMap((row) => {
        const user = byId.get(String(row.user_id))
        return user ? [{ ...asMembership(row), user }] : []
      })
    },
    async listMemberships(workspaceId) {
      const result = await client.from("memberships").select("*").eq("workspace_id", workspaceId)
      fail(result.error)
      return ((result.data ?? []) as Record<string, unknown>[]).map(asMembership)
    },
    async insertMembership(membership) {
      fail(
        (
          await client.from("memberships").insert({
            id: membership.id,
            workspace_id: membership.workspaceId,
            user_id: membership.userId,
            role: membership.role,
            created_at: membership.createdAt,
          })
        ).error,
      )
    },
    async deleteMembership(id) {
      fail((await client.from("memberships").delete().eq("id", id)).error)
    },
    async listClients(workspaceId) {
      const result = await client.from("clients").select("*").eq("workspace_id", workspaceId)
      fail(result.error)
      return ((result.data ?? []) as Record<string, unknown>[]).map(asClient)
    },
    async getClient(id) {
      const result = await client.from("clients").select("*").eq("id", id).maybeSingle()
      fail(result.error)
      return result.data ? asClient(result.data) : null
    },
    async insertClient(clientRecord) {
      fail(
        (
          await client.from("clients").insert({
            id: clientRecord.id,
            workspace_id: clientRecord.workspaceId,
            name: clientRecord.name,
            email: clientRecord.email,
            company: clientRecord.company,
            address: clientRecord.address,
            notes: clientRecord.notes,
            created_at: clientRecord.createdAt,
          })
        ).error,
      )
    },
    async updateClient(clientRecord) {
      fail(
        (
          await client
            .from("clients")
            .update({
              name: clientRecord.name,
              email: clientRecord.email,
              company: clientRecord.company,
              address: clientRecord.address,
              notes: clientRecord.notes,
            })
            .eq("id", clientRecord.id)
        ).error,
      )
    },
    async deleteClient(id) {
      fail((await client.from("clients").delete().eq("id", id)).error)
    },
    async listInvoices(workspaceId) {
      const result = await client.from("invoices").select("*").eq("workspace_id", workspaceId)
      fail(result.error)
      return attachLines(client, (result.data ?? []) as Record<string, unknown>[])
    },
    async listAllInvoices() {
      const result = await client.from("invoices").select("*")
      fail(result.error)
      return attachLines(client, (result.data ?? []) as Record<string, unknown>[])
    },
    async getInvoice(id) {
      const result = await client.from("invoices").select("*").eq("id", id).maybeSingle()
      fail(result.error)
      if (!result.data) return null
      const [invoice] = await attachLines(client, [result.data])
      return invoice ?? null
    },
    async getInvoiceByToken(token) {
      const result = await client.from("invoices").select("*").eq("public_token", token).maybeSingle()
      fail(result.error)
      if (!result.data) return null
      const [invoice] = await attachLines(client, [result.data])
      return invoice ?? null
    },
    async insertInvoice(invoice) {
      fail((await client.from("invoices").insert(invoiceRow(invoice))).error)
      await replaceLines(client, invoice)
    },
    async updateInvoice(invoice) {
      fail((await client.from("invoices").update(invoiceRow(invoice)).eq("id", invoice.id)).error)
      await replaceLines(client, invoice)
    },
    async listNotifications(userId, workspaceId) {
      const result = await client
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
      fail(result.error)
      return ((result.data ?? []) as Record<string, unknown>[]).map(asNotification)
    },
    async insertNotification(notification) {
      fail(
        (
          await client.from("notifications").insert({
            id: notification.id,
            workspace_id: notification.workspaceId,
            user_id: notification.userId,
            type: notification.type,
            title: notification.title,
            body: notification.body,
            href: notification.href,
            invoice_id: notification.invoiceId,
            read_at: notification.readAt,
            created_at: notification.createdAt,
          })
        ).error,
      )
    },
    async markNotificationRead(id, userId) {
      fail(
        (
          await client
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("id", id)
            .eq("user_id", userId)
        ).error,
      )
    },
    async markAllNotificationsRead(userId, workspaceId) {
      fail(
        (
          await client
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("user_id", userId)
            .eq("workspace_id", workspaceId)
            .is("read_at", null)
        ).error,
      )
    },
    async listEmails(workspaceId, userEmail) {
      const result = await client
        .from("emails")
        .select("*")
        .or(`workspace_id.eq.${workspaceId},and(workspace_id.is.null,to_email.eq.${userEmail})`)
        .order("created_at", { ascending: false })
      fail(result.error)
      return ((result.data ?? []) as Record<string, unknown>[]).map(asEmail)
    },
    async insertEmail(email) {
      fail(
        (
          await client.from("emails").insert({
            id: email.id,
            workspace_id: email.workspaceId,
            to_email: email.to,
            subject: email.subject,
            body: email.body,
            kind: email.kind,
            created_at: email.createdAt,
          })
        ).error,
      )
    },
    async insertToken(token) {
      fail(
        (
          await client.from("auth_tokens").insert({
            id: token.id,
            user_id: token.userId,
            email: token.email,
            token: token.token,
            type: token.type,
            expires_at: token.expiresAt,
            consumed_at: token.consumedAt,
            workspace_id: token.workspaceId,
            role: token.role,
            created_at: token.createdAt,
          })
        ).error,
      )
    },
    async findToken(token) {
      const result = await client.from("auth_tokens").select("*").eq("token", token).maybeSingle()
      fail(result.error)
      return result.data ? asToken(result.data) : null
    },
    async updateToken(token) {
      fail(
        (
          await client
            .from("auth_tokens")
            .update({ consumed_at: token.consumedAt })
            .eq("id", token.id)
        ).error,
      )
    },
  }
}
