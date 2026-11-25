"use client"

import { Button } from "@/components/ui/button"

export default function SurfaceError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="rounded-xl border bg-card p-6">
      <h1 className="font-heading text-3xl">This page did not load</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Billkit could not finish the request. Your invoices were not changed.
      </p>
      <Button type="button" className="mt-4 h-10" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  )
}
