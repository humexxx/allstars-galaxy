"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldError,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Heading, Text } from "@/components/ui/typography"
import { AuthService } from "@/lib/auth/auth-client"
import { signupSchema, type SignupData } from "@/schemas/auth"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillEmail = searchParams.get("email") ?? ""
  // Same allow-list as the login form — only same-origin paths survive.
  const nextRaw = searchParams.get("next")
  const next =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : null
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login"

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: prefillEmail,
    },
  })

  const onSubmit = async (data: SignupData): Promise<void> => {
    setError(null)

    try {
      await AuthService.signUpWithEmail(data.email, data.password, data.name, next)
      // Supabase holds the account until the email is confirmed, so the next
      // stop is the login page with that instruction on it.
      const params = new URLSearchParams({
        message: "Check your email for confirmation link",
      })
      if (next) params.set("next", next)
      router.push(`/login?${params.toString()}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error initializing signup")
    }
  }

  const isLoading = isSubmitting || isGoogleLoading

  async function handleGoogleLogin() {
    setIsGoogleLoading(true)
    try {
      await AuthService.signInWithGoogle(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error with Google login")
      setIsGoogleLoading(false)
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
          <Heading level="h3" as="h1">Create an account</Heading>
          <Text variant="muted" className="text-balance">
            Enter your email below to create your account
          </Text>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Full name</FieldLabel>
          <Input id="name" type="text" placeholder="John Doe" autoComplete="name" aria-invalid={!!errors.name} {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" placeholder="m@example.com" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
          <FieldError errors={[errors.email]} />
          <FieldDescription>
            We&apos;ll use this to contact you. We won&apos;t share your email.
          </FieldDescription>
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
          <FieldError errors={[errors.password]} />
          <FieldDescription>
            Must be at least 8 characters.
          </FieldDescription>
        </Field>
        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
          <Input id="confirm-password" type="password" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
          <FieldError errors={[errors.confirmPassword]} />
          <FieldDescription>Please confirm your password.</FieldDescription>
        </Field>
        <Field>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </Field>
        <FieldSeparator>Or continue with</FieldSeparator>
        <Field>
          <Button variant="outline" type="button" onClick={handleGoogleLogin} className="w-full" disabled={isLoading}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          </Button>
          <FieldDescription className="px-6 text-center">
            Already have an account? <Link href={loginHref}>Log in</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
