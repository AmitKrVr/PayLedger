"use client"

import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { useLogin } from "@/hooks/use-login"
import { getApiErrorMessage } from "@/lib/api/error-message"
import { loginSchema, type LoginFormData } from "@/lib/schema"
import { digitsOnly } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"

export function LoginForm() {
  const loginMutation = useLogin()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { mobile: "", password: "" },
  })

  const mobileField = register("mobile")

  const onSubmit = (data: LoginFormData) => {
    setError("root", { message: "" })
    loginMutation.mutate(data, {
      onError: (error) => {
        setError("root", { message: getApiErrorMessage(error) })
      },
    })
  }

  return (
    <Card className="w-full max-w-sm border-0 shadow-xl shadow-foreground/5">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your PayLedger account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="mobile">Mobile number</FieldLabel>
            <Input
              id="mobile"
              type="tel"
              inputMode="numeric"
              autoFocus
              placeholder="10-digit mobile number"
              {...mobileField}
              onChange={(e) => {
                e.target.value = digitsOnly(e.target.value, 10)
                mobileField.onChange(e)
              }}
            />
            <FieldError>{errors.mobile?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput id="password" placeholder="••••••••" {...register("password")} />
            <FieldError>{errors.password?.message}</FieldError>
          </Field>

          {errors.root?.message && (
            <Alert variant="destructive">
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" size="lg" isLoading={loginMutation.isPending} className="mt-1">
            {loginMutation.isPending ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
