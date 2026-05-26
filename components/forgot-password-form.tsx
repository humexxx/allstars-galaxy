"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Heading, Text } from "@/components/ui/typography"
import { AuthService } from "@/lib/services/auth-service"
import { useState } from "react"
import Link from "next/link"

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    const formData = new FormData(event.currentTarget)
    const email = formData.get("email") as string

    try {
      await AuthService.resetPasswordForEmail(email)
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error sending reset email")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <Heading level="h3" as="h1">Reset Password</Heading>
          <Text variant="muted" className="text-balance">
            Enter your email to receive a password reset link
          </Text>
        </div>
        
        {error && (
          <div
            className="text-destructive text-sm text-center p-2 bg-destructive/10 rounded"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        {success && (
          <div className="text-green-600 text-sm text-center p-2 bg-green-50 rounded border border-green-200" aria-live="polite">
            Check your email for the password reset link.
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" placeholder="m@example.com" autoComplete="email" required />
        </Field>
        
        <Field>
          <Button type="submit" disabled={isLoading || success} className="w-full">
            {isLoading ? "Sending..." : "Send Reset Link"}
          </Button>
        </Field>

        <div className="text-center text-sm">
          Remember your password?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Login
          </Link>
        </div>
      </FieldGroup>
    </form>
  )
}
