export type Role = "owner" | "member"
export type PlanId = "starter" | "pro"
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "none"
export type InvoiceStatus = "draft" | "sent" | "viewed" | "paid" | "overdue" | "void"
export type DiscountType = "none" | "percent" | "fixed"
export type NotificationType =
  | "invoice.sent"
  | "invoice.viewed"
  | "invoice.paid"
  | "invoice.overdue"
  | "billing"
  | "team"
export type EmailKind = "invoice" | "reminder" | "auth" | "billing" | "viewed" | "overdue"

export type User = {
  id: string
  email: string
  name: string
  passwordHash: string | null
  isSuperAdmin: boolean
  createdAt: string
}

export type Workspace = {
  id: string
  name: string
  slug: string
  plan: PlanId
  subscriptionStatus: SubscriptionStatus
  trialEndsAt: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
  invoicePrefix: string
  nextNumber: number
  address: string
  email: string
  createdAt: string
}

export type Membership = {
  id: string
  workspaceId: string
  userId: string
  role: Role
  createdAt: string
}

export type Client = {
  id: string
  workspaceId: string
  name: string
  email: string
  company: string
  address: string
  notes: string
  createdAt: string
}

export type InvoiceLine = {
  id: string
  description: string
  quantity: number
  unitAmountCents: number
}

export type Invoice = {
  id: string
  workspaceId: string
  clientId: string
  number: string
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  currency: "USD"
  taxRateBps: number
  discountType: DiscountType
  discountValue: number
  notes: string
  publicToken: string
  lines: InvoiceLine[]
  sentAt: string | null
  viewedAt: string | null
  paidAt: string | null
  voidedAt: string | null
  createdAt: string
  updatedAt: string
}

export type Notification = {
  id: string
  workspaceId: string
  userId: string
  type: NotificationType
  title: string
  body: string
  href: string
  invoiceId: string | null
  readAt: string | null
  createdAt: string
}

export type EmailMessage = {
  id: string
  workspaceId: string | null
  to: string
  subject: string
  body: string
  kind: EmailKind
  createdAt: string
}

export type AuthToken = {
  id: string
  userId: string | null
  email: string
  token: string
  type: "magic" | "reset" | "invite"
  expiresAt: string
  consumedAt: string | null
  workspaceId: string | null
  role: Role | null
  createdAt: string
}

export type Database = {
  users: User[]
  workspaces: Workspace[]
  memberships: Membership[]
  clients: Client[]
  invoices: Invoice[]
  notifications: Notification[]
  emails: EmailMessage[]
  tokens: AuthToken[]
}

export type PricedInvoice = Invoice & {
  subtotalCents: number
  discountCents: number
  taxableCents: number
  taxCents: number
  totalCents: number
  displayStatus: InvoiceStatus
}
