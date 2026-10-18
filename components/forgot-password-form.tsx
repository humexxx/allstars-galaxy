"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Heading, Text } from "@/components/ui/typography"
import { AuthService } from "@/lib/auth/auth-client"
import { forgotPasswordSchema, type ForgotPasswordData } from "@/schemas/auth"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordData): Promise<void> => {
    setError(null)
    setSuccess(false)

    try {
      await AuthService.resetPasswordForEmail(data.email)
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error sending reset email")
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <Heading level="h3" as="h1">Reset password</Heading>
          <Text variant="muted" className="text-balance">
            Enter your email to receive a password reset link
          </Text>
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="success">
            <AlertDescription>
              Check your email for the password reset link.
            </AlertDescription>
          </Alert>
        )}

        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" placeholder="m@example.com" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
          <FieldError errors={[errors.email]} />
        </Field>

        <Field>
          <Button type="submit" disabled={isSubmitting || success} className="w-full">
            {isSubmitting ? "Sending…" : "Send reset link"}
          </Button>
        </Field>

        <div className="text-center text-sm">
          Remember your password?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Log in
          </Link>
        </div>
      </FieldGroup>
    </form>
  )
}
