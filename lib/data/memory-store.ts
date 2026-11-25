import "server-only"

import type {
  AuthToken,
  Client,
  EmailMessage,
  Invoice,
  Membership,
  Notification,
  User,
  Workspace,
} from "@/lib/domain/types"
import type { Database } from "@/lib/domain/types"
import { buildSeed } from "@/lib/data/seed"
import type { Store } from "@/lib/data/store"

const globalStore = globalThis as unknown as { __billkitDb?: Database }

export function resetDatabase() {
  globalStore.__billkitDb = buildSeed(new Date())
}

function database(): Database {
  if (!globalStore.__billkitDb) globalStore.__billkitDb = buildSeed(new Date())
  return globalStore.__billkitDb
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

export const memoryStore: Store = {
  async findUserByEmail(email) {
    const user = database().users.find((item) => item.email.toLowerCase() === email.toLowerCase())
    return user ? clone(user) : null
  },
  async findUserById(id) {
    const user = database().users.find((item) => item.id === id)
    return user ? clone(user) : null
  },
  async insertUser(user: User) {
    database().users.push(clone(user))
  },
  async updateUser(user: User) {
    const db = database()
    const index = db.users.findIndex((item) => item.id === user.id)
    if (index >= 0) db.users[index] = clone(user)
  },
  async listWorkspacesForUser(userId) {
    const db = database()
    return db.memberships
      .filter((membership) => membership.userId === userId)
      .map((membership) => {
        const workspace = db.workspaces.find((item) => item.id === membership.workspaceId)
        return workspace ? { workspace: clone(workspace), role: membership.role } : null
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  },
  async getWorkspace(id) {
    const workspace = database().workspaces.find((item) => item.id === id)
    return workspace ? clone(workspace) : null
  },
  async getWorkspaceBySlug(slug) {
    const workspace = database().workspaces.find((item) => item.slug === slug)
    return workspace ? clone(workspace) : null
  },
  async insertWorkspace(workspace: Workspace, membership: Membership) {
    const db = database()
    db.workspaces.push(clone(workspace))
    db.memberships.push(clone(membership))
  },
  async updateWorkspace(workspace: Workspace) {
    const db = database()
    const index = db.workspaces.findIndex((item) => item.id === workspace.id)
    if (index >= 0) db.workspaces[index] = clone(workspace)
  },
  async listAllWorkspaces() {
    return clone(database().workspaces)
  },
  async listMembers(workspaceId) {
    const db = database()
    return db.memberships
      .filter((membership) => membership.workspaceId === workspaceId)
      .map((membership) => {
        const user = db.users.find((item) => item.id === membership.userId)
        return user ? { ...clone(membership), user: clone(user) } : null
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  },
  async listMemberships(workspaceId) {
    return clone(database().memberships.filter((membership) => membership.workspaceId === workspaceId))
  },
  async insertMembership(membership: Membership) {
    database().memberships.push(clone(membership))
  },
  async deleteMembership(id) {
    const db = database()
    db.memberships = db.memberships.filter((membership) => membership.id !== id)
  },
  async listClients(workspaceId) {
    return clone(database().clients.filter((client) => client.workspaceId === workspaceId))
  },
  async getClient(id) {
    const client = database().clients.find((item) => item.id === id)
    return client ? clone(client) : null
  },
  async insertClient(client: Client) {
    database().clients.push(clone(client))
  },
  async updateClient(client: Client) {
    const db = database()
    const index = db.clients.findIndex((item) => item.id === client.id)
    if (index >= 0) db.clients[index] = clone(client)
  },
  async deleteClient(id) {
    const db = database()
    db.clients = db.clients.filter((client) => client.id !== id)
  },
  async listInvoices(workspaceId) {
    return clone(database().invoices.filter((invoice) => invoice.workspaceId === workspaceId))
  },
  async listAllInvoices() {
    return clone(database().invoices)
  },
  async getInvoice(id) {
    const invoice = database().invoices.find((item) => item.id === id)
    return invoice ? clone(invoice) : null
  },
  async getInvoiceByToken(token) {
    const invoice = database().invoices.find((item) => item.publicToken === token)
    return invoice ? clone(invoice) : null
  },
  async insertInvoice(invoice: Invoice) {
    database().invoices.push(clone(invoice))
  },
  async updateInvoice(invoice: Invoice) {
    const db = database()
    const index = db.invoices.findIndex((item) => item.id === invoice.id)
    if (index >= 0) db.invoices[index] = clone(invoice)
  },
  async listNotifications(userId, workspaceId) {
    return clone(
      database()
        .notifications.filter(
          (notification) => notification.userId === userId && notification.workspaceId === workspaceId,
        )
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    )
  },
  async insertNotification(notification: Notification) {
    database().notifications.push(clone(notification))
  },
  async markNotificationRead(id, userId) {
    const notification = database().notifications.find(
      (item) => item.id === id && item.userId === userId,
    )
    if (notification && !notification.readAt) notification.readAt = new Date().toISOString()
  },
  async markAllNotificationsRead(userId, workspaceId) {
    const now = new Date().toISOString()
    for (const notification of database().notifications) {
      if (notification.userId === userId && notification.workspaceId === workspaceId && !notification.readAt) {
        notification.readAt = now
      }
    }
  },
  async listEmails(workspaceId, userEmail) {
    return clone(
      database()
        .emails.filter(
          (email) => email.workspaceId === workspaceId || (email.workspaceId === null && email.to === userEmail),
        )
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    )
  },
  async insertEmail(email: EmailMessage) {
    database().emails.push(clone(email))
  },
  async insertToken(token: AuthToken) {
    database().tokens.push(clone(token))
  },
  async findToken(token) {
    const found = database().tokens.find((item) => item.token === token)
    return found ? clone(found) : null
  },
  async updateToken(token: AuthToken) {
    const db = database()
    const index = db.tokens.findIndex((item) => item.id === token.id)
    if (index >= 0) db.tokens[index] = clone(token)
  },
}
