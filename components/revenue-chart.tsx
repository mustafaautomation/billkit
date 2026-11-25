import { formatMoney } from "@/lib/domain/money"

export function RevenueChart({
  data,
}: {
  data: { month: string; label: string; totalCents: number }[]
}) {
  const max = Math.max(...data.map((point) => point.totalCents), 1)
  return (
    <div className="mt-4">
      <div className="flex h-64 items-end gap-2" aria-hidden="true">
        {data.map((point) => {
          const height = point.totalCents === 0 ? 0 : Math.max(10, Math.round((point.totalCents / max) * 100))
          return (
            <div key={point.month} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <p className="mb-1 truncate text-center text-[11px] text-muted-foreground">
                {point.totalCents ? formatMoney(point.totalCents) : ""}
              </p>
              <div className="flex h-44 items-end">
                <div className="w-full rounded-t-md bg-primary" style={{ height: `${height}%` }} />
              </div>
              <p className="mt-2 text-center text-xs">{point.label}</p>
            </div>
          )
        })}
      </div>
      <table className="sr-only">
        <caption>Paid revenue by month</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Paid</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.month}>
              <td>{point.label}</td>
              <td>{formatMoney(point.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
