"use client";

import { useActionState } from "react";
import { AlertCircle, ArrowRight, Loader2, Mail, MailCheck } from "lucide-react";
import { Button, Input } from "@/components/ui/UIComponents";
import { recuperar, type EstadoRecuperar } from "./actions";

export default function RecuperarForm({ emailInicial }: { emailInicial?: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoRecuperar, FormData>(recuperar, {});

  if (estado.enviado) {
    return (
      <div
        role="status"
        className="mt-7 flex gap-3 rounded-xl border border-brand/30 bg-brand/10 p-4 text-sm animate-in fade-in"
      >
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <p className="leading-relaxed">
          Si hay una cuenta con ese email, te mandamos un link para entrar. Revisá tu bandeja de
          entrada y la carpeta de spam. <span className="text-muted-foreground">El link vence en poco tiempo.</span>
        </p>
      </div>
    );
  }

  return (
    <form action={accion} className="mt-7 space-y-4">
      {estado.error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-r-md border-l-4 border-destructive bg-destructive/10 p-3 text-sm font-medium text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {estado.error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="ml-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
            autoFocus
            defaultValue={emailInicial}
            placeholder="vos@empresa.com"
            aria-invalid={Boolean(estado.error)}
            className="h-12 border-border bg-secondary/30 pl-10 transition-all focus:border-primary focus:bg-background"
          />
        </div>
      </div>
      <Button type="submit" disabled={pendiente} className="h-12 w-full text-base font-semibold shadow-lg shadow-primary/20">
        {pendiente ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            Enviarme el link <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
