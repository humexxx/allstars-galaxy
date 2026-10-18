"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Heading, Text } from "@/components/ui/typography"
import { AuthService } from "@/lib/auth/auth-client"
import { cn } from "@/lib/utils"
import { updatePasswordSchema, type UpdatePasswordData } from "@/schemas/auth"

/**
 * The last step of "forgot password": the reset email signs the user in
 * through /auth/callback and lands them here to choose the new password.
 */
export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordData>({
    resolver: zodResolver(updatePasswordSchema),
  })

  const onSubmit = async (data: UpdatePasswordData): Promise<void> => {
    setError(null)
    try {
      await AuthService.updatePassword(data.password)
      router.push("/portal")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update the password")
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
          <Heading level="h3" as="h1">Choose a new password</Heading>
          <Text variant="muted" className="text-balance">
            You&apos;ll use it the next time you log in.
          </Text>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
          <FieldError errors={[errors.password]} />
          <FieldDescription>Must be at least 8 characters.</FieldDescription>
        </Field>
        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
          <Input id="confirm-password" type="password" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
          <FieldError errors={[errors.confirmPassword]} />
        </Field>
        <Field>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Saving…" : "Save password"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
