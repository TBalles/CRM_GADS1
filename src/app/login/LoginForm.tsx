"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, MailCheck } from "lucide-react";
import { Button, Input } from "@/components/ui/UIComponents";
import { login } from "./actions";

const labelClass =
  "ml-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const fieldClass =
  "h-12 bg-secondary/30 border-border pl-10 transition-all focus:border-primary focus:bg-background";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="mt-2 h-12 w-full text-base font-semibold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01]"
    >
      {pending ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          Ingresar <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}

export default function LoginForm({
  error,
  aviso,
  emailInicial,
}: {
  error?: string;
  aviso?: string;
  emailInicial?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={login} className="mt-7 space-y-4">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-r-md border-l-4 border-destructive bg-destructive/10 p-3 text-sm font-medium text-destructive animate-in fade-in slide-in-from-top-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Aviso informativo (no es un error): p. ej. "te reenviamos la activación". */}
      {aviso && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-r-md border-l-4 border-brand bg-brand/10 p-3 text-sm font-medium animate-in fade-in slide-in-from-top-2"
        >
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          {aviso}
        </div>
      )}

      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <div className="relative mt-1.5">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus={!emailInicial}
            defaultValue={emailInicial}
            placeholder="vos@empresa.com"
            aria-invalid={Boolean(error)}
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className={labelClass}>
            Contraseña
          </label>
          <Link
            href={emailInicial ? `/recuperar?email=${encodeURIComponent(emailInicial)}` : "/recuperar"}
            className="rounded-sm text-xs font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <div className="relative mt-1.5">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            autoFocus={Boolean(emailInicial)}
            placeholder="••••••••"
            aria-invalid={Boolean(error)}
            className={`${fieldClass} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
