import Link from "next/link"

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
      <h1 className="font-heading text-4xl">That record was not found.</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        It may belong to another workspace, or the link is no longer valid.
      </p>
      <Link href="/" className="mt-6 text-sm underline-offset-4 hover:underline">Back to Billkit</Link>
    </main>
  )
}
