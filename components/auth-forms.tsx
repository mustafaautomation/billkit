"use client"

import { useActionState } from "react"
import Link from "next/link"
import {
  forgotAction,
  loginAction,
  magicAction,
  resetAction,
  signupAction,
  type FormState,
} from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorNote, Field } from "@/components/ui-bits"

const initial: FormState = { error: "" }

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial)
  return (
    <form action={action} className="grid gap-4">
      <ErrorNote>{state.error}</ErrorNote>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" aria-invalid={!!state.error} />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-10" aria-invalid={!!state.error} />
      </Field>
      <Button type="submit" className="h-10" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/magic" className="underline-offset-4 hover:underline">Email me a link</Link>
        <Link href="/forgot-password" className="underline-offset-4 hover:underline">Forgot password</Link>
      </div>
    </form>
  )
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, initial)
  return (
    <form action={action} className="grid gap-4">
      <ErrorNote>{state.error}</ErrorNote>
      <Field label="Full name" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" required className="h-10" />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className="h-10" />
      </Field>
      <Field label="Workspace name" htmlFor="workspace">
        <Input id="workspace" name="workspace" required className="h-10" />
      </Field>
      <Button type="submit" className="h-10" disabled={pending}>
        {pending ? "Creating workspace…" : "Create workspace"}
      </Button>
    </form>
  )
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotAction, initial)
  return (
    <form action={action} className="grid gap-4">
      <ErrorNote>{state.error}</ErrorNote>
      {state.error === "" && state.mockLink === undefined && state !== initial ? (
        <p role="status" className="text-sm">If an account exists, a reset message is on its way.</p>
      ) : null}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" />
      </Field>
      <Button type="submit" className="h-10" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      {state.mockLink ? (
        <p className="rounded-lg bg-muted p-3 text-sm">
          Mock email, no provider configured.{" "}
          <a className="font-medium underline" href={state.mockLink}>Open reset link</a>
        </p>
      ) : null}
    </form>
  )
}

export function MagicForm({ error }: { error?: string }) {
  const [state, action, pending] = useActionState(magicAction, { error: error ?? "" })
  return (
    <form action={action} className="grid gap-4">
      <ErrorNote>{state.error}</ErrorNote>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" />
      </Field>
      <Button type="submit" className="h-10" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
      {state.mockLink ? (
        <p className="rounded-lg bg-muted p-3 text-sm">
          Mock email, no provider configured.{" "}
          <a className="font-medium underline" href={state.mockLink}>Open sign-in link</a>
        </p>
      ) : null}
    </form>
  )
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetAction, initial)
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <ErrorNote>{state.error}</ErrorNote>
      <Field label="New password" htmlFor="password" hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className="h-10" />
      </Field>
      <Button type="submit" className="h-10" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  )
}
