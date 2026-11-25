/** Fictional studios. The password is public demo data, not a production secret. */
export const DEMO_PASSWORD = "ledger-demo-2026"

export const DEMO_ACCOUNTS = [
  {
    email: "maya@northwind.studio",
    name: "Maya Chen",
    workspace: "Northwind Studio",
    role: "Owner",
  },
  {
    email: "owen@northwind.studio",
    name: "Owen Park",
    workspace: "Northwind Studio",
    role: "Member",
  },
  {
    email: "leah@cedar.legal",
    name: "Leah Okonkwo",
    workspace: "Cedar Legal",
    role: "Owner",
  },
  {
    email: "root@billkit.test",
    name: "Billkit Root",
    workspace: "Billkit Ops",
    role: "Super admin",
  },
] as const
