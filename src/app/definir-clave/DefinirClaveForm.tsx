"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { Button, Input } from "@/components/ui/UIComponents";
import { definirClave, type EstadoClave } from "./actions";

const labelClass = "ml-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const fieldClass =
  "h-12 bg-secondary/30 border-border pl-10 pr-11 transition-all focus:border-primary focus:bg-background";

export default function DefinirClaveForm({ textoBoton }: { textoBoton: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoClave, FormData>(definirClave, {});
  const [ver, setVer] = useState(false);

  return (
    <form action={accion} className="mt-7 space-y-4">
      {estado.error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-r-md border-l-4 border-destructive bg-destructive/10 p-3 text-sm font-medium text-destructive animate-in fade-in slide-in-from-top-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {estado.error}
        </div>
      )}

      {(["clave", "repetida"] as const).map((campo) => (
        <div key={campo}>
          <label htmlFor={campo} className={labelClass}>
            {campo === "clave" ? "Nueva contraseña" : "Repetila"}
          </label>
          <div className="relative mt-1.5">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={campo}
              name={campo}
              type={ver ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              autoFocus={campo === "clave"}
              placeholder="Mínimo 8 caracteres"
              aria-invalid={Boolean(estado.error)}
              className={fieldClass}
            />
            {campo === "clave" && (
              <button
                type="button"
                onClick={() => setVer((v) => !v)}
                aria-label={ver ? "Ocultar contraseñas" : "Mostrar contraseñas"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
              >
                {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      ))}

      <Button
        type="submit"
        disabled={pendiente}
        className="mt-2 h-12 w-full text-base font-semibold shadow-lg shadow-primary/20"
      >
        {pendiente ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            {textoBoton} <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
