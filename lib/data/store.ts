import type {
  AuthToken,
  Client,
  EmailMessage,
  Invoice,
  Membership,
  Notification,
  Role,
  User,
  Workspace,
} from "@/lib/domain/types"

export type MembershipWithUser = Membership & { user: User }
export type WorkspaceAccess = { workspace: Workspace; role: Role }

export interface Store {
  findUserByEmail(email: string): Promise<User | null>
  findUserById(id: string): Promise<User | null>
  insertUser(user: User): Promise<void>
  updateUser(user: User): Promise<void>
  listWorkspacesForUser(userId: string): Promise<WorkspaceAccess[]>
  getWorkspace(id: string): Promise<Workspace | null>
  getWorkspaceBySlug(slug: string): Promise<Workspace | null>
  insertWorkspace(workspace: Workspace, membership: Membership): Promise<void>
  updateWorkspace(workspace: Workspace): Promise<void>
  listAllWorkspaces(): Promise<Workspace[]>
  listMembers(workspaceId: string): Promise<MembershipWithUser[]>
  listMemberships(workspaceId: string): Promise<Membership[]>
  insertMembership(membership: Membership): Promise<void>
  deleteMembership(id: string): Promise<void>
  listClients(workspaceId: string): Promise<Client[]>
  getClient(id: string): Promise<Client | null>
  insertClient(client: Client): Promise<void>
  updateClient(client: Client): Promise<void>
  deleteClient(id: string): Promise<void>
  listInvoices(workspaceId: string): Promise<Invoice[]>
  listAllInvoices(): Promise<Invoice[]>
  getInvoice(id: string): Promise<Invoice | null>
  getInvoiceByToken(token: string): Promise<Invoice | null>
  insertInvoice(invoice: Invoice): Promise<void>
  updateInvoice(invoice: Invoice): Promise<void>
  listNotifications(userId: string, workspaceId: string): Promise<Notification[]>
  insertNotification(notification: Notification): Promise<void>
  markNotificationRead(id: string, userId: string): Promise<void>
  markAllNotificationsRead(userId: string, workspaceId: string): Promise<void>
  listEmails(workspaceId: string, userEmail: string): Promise<EmailMessage[]>
  insertEmail(email: EmailMessage): Promise<void>
  insertToken(token: AuthToken): Promise<void>
  findToken(token: string): Promise<AuthToken | null>
  updateToken(token: AuthToken): Promise<void>
}
