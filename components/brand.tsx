import Link from "next/link"
import { cn } from "@/lib/utils"

export function Mark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-heading text-lg tracking-tight", className)}>
      <span className="grid size-7 place-items-center rounded-md bg-primary text-sm text-primary-foreground">B</span>
      Billkit
    </span>
  )
}

export function TextLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link href={href} className={cn("text-sm font-medium underline-offset-4 hover:underline", className)}>
      {children}
    </Link>
  )
}
