"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react"

import { signInSchema, type SignInFormData } from "@/lib/schema"
import { useLogin } from "@/hooks/use-login"
import { getApiErrorMessage } from "@/lib/api/error-message"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function LoginForm() {
  const [showPassword, setShowPassword] = React.useState(false)
  const loginMutation = useLogin()

  const form = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = (data: SignInFormData) => {
    form.clearErrors("root")
    loginMutation.mutate(data, {
      onError: (error) => {
        form.setError("root", { message: getApiErrorMessage(error) })
      },
    })
  }

  return (
    <div className="w-full max-w-md">
      {/* Translucent Card Container */}
      <div className="relative rounded-2xl bg-card/90 backdrop-blur-xl border border-border p-8 shadow-2xl overflow-hidden">
        {/* Corner Accents */}
        <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-primary/40 rounded-tl-2xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-ring/40 rounded-tr-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-ring/40 rounded-bl-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-primary/40 rounded-br-2xl pointer-events-none" />

        {/* Card Header */}
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome Back
          </h1>
          <p className="text-sm text-muted-foreground font-normal leading-relaxed">
            Sign in to explore and manage your products seamlessly.
          </p>
        </div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-0.5">
                  <FormLabel className="text-sm font-medium text-foreground">
                    Email
                  </FormLabel>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <FormControl>
                      <Input
                        type="email"
                        autoFocus
                        placeholder="Enter your email"
                        className="h-11 pl-10 pr-4 bg-background/80 border-input text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-ring transition-colors rounded-xl text-sm"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage className="-mt-0.5 text-destructive" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-0.5">
                  <FormLabel className="text-sm font-medium text-foreground">
                    Password
                  </FormLabel>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        className="h-11 pl-10 pr-10 bg-background/80 border-input text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-ring transition-colors rounded-xl text-sm"
                        {...field}
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <FormMessage className="-mt-0.5 text-destructive" />
                </FormItem>
              )}
            />

            {form.formState.errors.root?.message && (
              <p className="text-sm text-destructive -mt-4" role="alert">
                {form.formState.errors.root.message}
              </p>
            )}

            <Button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all duration-200 shadow-md border border-border active:scale-[0.99] text-sm cursor-pointer"
            >
              {loginMutation.isPending ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
