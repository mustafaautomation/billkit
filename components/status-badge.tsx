import type { InvoiceStatus } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

const styles: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-foreground",
  sent: "bg-sky-100 text-sky-950",
  viewed: "bg-amber-100 text-amber-950",
  paid: "bg-emerald-100 text-emerald-950",
  overdue: "bg-rose-100 text-rose-950",
  void: "bg-stone-200 text-stone-700",
}

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        styles[status],
      )}
    >
      {status}
    </span>
  )
}
