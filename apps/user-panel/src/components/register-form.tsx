"use client"

import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { useRegister } from "@/hooks/use-register"
import { getApiErrorMessage } from "@/lib/api/error-message"
import { registerSchema, type RegisterFormData } from "@/lib/schema"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function RegisterForm() {
  const registerMutation = useRegister()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", mobile: "", email: "", password: "" },
  })

  const onSubmit = (data: RegisterFormData) => {
    setError("root", { message: "" })
    registerMutation.mutate(data, {
      onError: (error) => {
        setError("root", { message: getApiErrorMessage(error) })
      },
    })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>It only takes a minute.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="name">Full name</FieldLabel>
            <Input id="name" autoFocus placeholder="Your name" {...register("name")} />
            <FieldError>{errors.name?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="mobile">Mobile number</FieldLabel>
            <Input
              id="mobile"
              type="tel"
              placeholder="10-digit mobile number"
              {...register("mobile")}
            />
            <FieldError>{errors.mobile?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="email">Email (optional)</FieldLabel>
            <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
            <FieldError>{errors.email?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              {...register("password")}
            />
            <FieldError>{errors.password?.message}</FieldError>
          </Field>

          {errors.root?.message && (
            <Alert variant="destructive">
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" size="lg" isLoading={registerMutation.isPending} className="mt-1">
            {registerMutation.isPending ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
