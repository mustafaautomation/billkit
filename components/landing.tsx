import Link from "next/link"
import { Mark } from "@/components/brand"
import { buttonVariants } from "@/components/ui/button"
import { formatMoney } from "@/lib/domain/money"
import { PLANS } from "@/lib/domain/plans"
import { cn } from "@/lib/utils"

const faqs = [
  {
    q: "Can I try it without an account?",
    a: "Yes. The Northwind Studio demo is public and read-only. Nothing you do there changes the books.",
  },
  {
    q: "What if I do not have Stripe yet?",
    a: "Billkit runs the full payment flow in mock mode. When you add a Stripe test key, checkout switches to Stripe without a rewrite.",
  },
  {
    q: "Who can see another studio's invoices?",
    a: "Nobody. Each workspace is a tenant. Members see their own clients, invoices, and ledger. A super admin sees plan and usage, not a client's home address.",
  },
  {
    q: "Do you store card numbers?",
    a: "No. Live payments go through Stripe Checkout. Mock mode never asks for a card.",
  },
]

export function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
        <Mark />
        <nav className="flex items-center gap-4 text-sm">
          <a href="#pricing" className="hidden sm:inline">Pricing</a>
          <Link href="/demo">Demo</Link>
          <Link href="/login">Log in</Link>
          <Link href="/signup" className={cn(buttonVariants(), "h-9")}>Start free</Link>
        </nav>
      </header>
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1.1fr_0.9fr] md:py-20">
          <div>
            <p className="text-sm font-medium tracking-wide text-primary uppercase">For studios and small firms</p>
            <h1 className="mt-3 font-heading text-5xl leading-[1.05] tracking-tight sm:text-6xl">
              Send the invoice. Know what is still out.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Billkit is the billing desk for freelancers and agencies. Line items, tax, a payment page a client will actually open, and an honest view of overdue work.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={cn(buttonVariants(), "h-11 px-4")}>Create a workspace</Link>
              <Link href="/demo" className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}>
                Open the Northwind demo
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">14-day Pro trial. No card in mock mode.</p>
          </div>
          <article className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Invoice</p>
                <p className="font-heading text-2xl">NW-1044</p>
              </div>
              <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-950">Overdue</span>
            </div>
            <p className="mt-4 text-sm">Fieldnote Coffee</p>
            <p className="text-sm text-muted-foreground">Winter packaging · due 18 days ago</p>
            <dl className="mt-6 grid gap-2 text-sm">
              <div className="flex justify-between"><dt>Packaging dielines</dt><dd>$1,800.00</dd></div>
              <div className="flex justify-between"><dt>Print management</dt><dd>$950.00</dd></div>
              <div className="flex justify-between"><dt>Press checks</dt><dd>$500.00</dd></div>
              <div className="mt-2 flex justify-between border-t pt-2 font-medium"><dt>Total</dt><dd>$3,250.00</dd></div>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">Sample from the public demo. No real client, no real charge.</p>
          </article>
        </section>
        <section className="border-y bg-card/60">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
            {[
              ["A real invoice", "Drafts, numbering, tax, discounts, notes, and a PDF that looks like it came from the studio, not a spreadsheet."],
              ["A page the client can pay", "Each invoice has a public link. Stripe Checkout in test mode, or a mock confirmation when keys are absent."],
              ["A ledger you can trust", "Outstanding, paid this month, overdue count, six months of revenue, and aging buckets."],
            ].map(([title, body]) => (
              <div key={title}>
                <h2 className="font-heading text-2xl">{title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>
        <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-heading text-4xl">Simple plans</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">Start on a Pro trial. Stay on Starter if the practice is small. Move to Pro when the team grows.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {(["starter", "pro"] as const).map((id) => {
              const plan = PLANS[id]
              return (
                <article key={id} className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
                  <h3 className="font-heading text-3xl">{plan.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                  <p className="mt-4 font-heading text-4xl">{formatMoney(plan.monthlyCents)}<span className="text-base text-muted-foreground"> / month</span></p>
                  <ul className="mt-4 grid gap-2 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <Link href="/signup" className={cn(buttonVariants(), "mt-6 h-10")}>Start with {plan.name}</Link>
                </article>
              )
            })}
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <h2 className="font-heading text-3xl">Questions</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {faqs.map((item) => (
              <article key={item.q} className="rounded-xl border p-4">
                <h3 className="font-medium">{item.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <Mark />
          <p>Fictional studios only. Northwind and Cedar are not real firms.</p>
        </div>
      </footer>
    </div>
  )
}
