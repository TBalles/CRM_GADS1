"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/crm/Button";
import { ConfirmDialog } from "@/components/crm/Dialog";
import { InlineBanner } from "@/components/crm/Feedback";
import { Field, Textarea } from "@/components/crm/Field";
import { SectionBar } from "@/components/crm/PageBar";
import { useCrmToast } from "@/components/crm/Toast";
import { CampoOpciones, CampoTexto, Par } from "@/components/crm/cuenta/FormDrawer";
import { TYPE, cn } from "@/components/crm/cx";
import { createClient } from "@/lib/supabase/client";
import { cuitValido, formatearCuit } from "@/lib/cuit";
import { sinTrabarse } from "@/lib/guardar";
import { sitioWebValido } from "@/lib/sitioweb";
import type { Tables } from "@/lib/supabase/types";
import { hayCambios, valoresDe, type ValoresEmpresa } from "./logica";

type Organizacion = Tables<"organizaciones">;

/**
 * El CHECK de la base solo admite estas tres. "Consumidor final" no esta a proposito: es la condicion de quien COMPRA,
 * no de quien emite el presupuesto.
 */
const CONDICIONES_IVA = [
  { value: "responsable_inscripto", label: "Responsable Inscripto" },
  { value: "monotributo", label: "Monotributo" },
  { value: "exento", label: "Exento" },
];
const etiquetaIva = (valor: string) => CONDICIONES_IVA.find((c) => c.value === valor)?.label ?? "";

/** Lo mismo que aplica el bucket `logos`: PNG, JPG o WebP de hasta 1 MB. SVG afuera (puede traer scripts). */
const EXTENSIONES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_LOGO_BYTES = 1024 * 1024;
const VIGENCIA_URL_FIRMADA = 60 * 60;
/** La URL firmada dura 60 min: se renueva a los 50 y al volver a la pestaña. */
const RENOVAR_URL_MS = 50 * 60 * 1000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errores = Partial<Record<"cuit" | "email" | "sitio_web" | "validez", string>>;
/** El id del campo de cada error (en el orden del formulario): ahí va el foco si la validación frena el guardado. */
const ID_DE_ERROR: Record<keyof Errores, string> = { cuit: "cuit", email: "email", sitio_web: "sitio_web", validez: "presupuesto_validez_dias" };

/**
 * Un grupo del formulario sin caja: título (13/600) y, si hace falta, una línea de ayuda; los campos debajo. Con lugar
 * (contenedor de 84rem, la pantalla de 1903) pasa a la forma de una página de ajustes: el título y la ayuda a la
 * izquierda, los campos a la derecha.
 */
function Grupo({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  const id = React.useId();
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 border-t border-(--crm-border) pt-4 @[84rem]:grid @[84rem]:grid-cols-[14rem_minmax(0,40rem)] @[84rem]:gap-8"
    >
      <div className="flex flex-col gap-1">
        <h3 id={id} className="text-[13px] font-semibold leading-[18px]">
          {titulo}
        </h3>
        {ayuda && <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>{ayuda}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

/**
 * Datos de la empresa (CRM 2.0): el formulario del encabezado y el pie de los presupuestos, el logo y una vista previa
 * de cómo sale en la hoja. Mismos campos (ids), validaciones, escrituras, flujo de storage y mensajes que el legacy.
 *
 * - Tres grupos sin caja (Identidad fiscal, Contacto, Presupuestos); el logo y la vista previa al lado desde 56rem de
 *   contenedor, debajo con menos.
 * - "Guardar cambios" es UN solo botón (el de siempre). Con cambios sin guardar su fila se vuelve una barra pegada abajo
 *   del área de trabajo ("Cambios sin guardar" · "Descartar" · "Guardar cambios"); sin cambios es una fila más al final.
 *   "Descartar" vuelve a los valores guardados (estado local; no escribe nada). `onCambios` avisa a la sub-navegación.
 * - Si el guardado falla, el foco va al aviso (que puede estar fuera de la vista en el celular); si la validación frena,
 *   al primer campo con error.
 */
export default function DatosEmpresa({
  organizacion,
  logoUrl: logoUrlInicial,
  onCambios,
}: {
  organizacion: Organizacion;
  logoUrl: string | null;
  onCambios?: (sucio: boolean) => void;
}) {
  const router = useRouter();
  const { showToast } = useCrmToast();

  const guardado = React.useMemo(() => valoresDe(organizacion), [organizacion]);
  const [v, setV] = React.useState<ValoresEmpresa>(guardado);
  const [errores, setErrores] = React.useState<Errores>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const aviso = React.useRef<HTMLDivElement>(null);
  const sucio = hayCambios(v, guardado);

  const [logoPath, setLogoPath] = React.useState(organizacion.logo_path);
  const [logoUrl, setLogoUrl] = React.useState(logoUrlInicial);
  const [logoError, setLogoError] = React.useState<string | null>(null);
  const [logoOcupado, setLogoOcupado] = React.useState(false);
  const [quitando, setQuitando] = React.useState(false);
  const inputArchivo = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    onCambios?.(sucio);
  }, [sucio, onCambios]);

  // Un error del guardado se anuncia (role="alert") y además recibe el foco: en el celular el aviso queda arriba del
  // formulario, fuera de la vista, y el foco estaba en el botón de abajo.
  React.useEffect(() => {
    if (error) aviso.current?.focus();
  }, [error]);

  // La URL firmada del logo vence: sin esto, una pestaña abierta mucho rato termina mostrando una imagen rota.
  React.useEffect(() => {
    if (!logoPath) return;
    const path = logoPath;
    let vivo = true;
    async function renovar() {
      try {
        const { data } = await createClient().storage.from("logos").createSignedUrl(path, VIGENCIA_URL_FIRMADA);
        if (vivo && data?.signedUrl) setLogoUrl(data.signedUrl);
      } catch {
        // Sin red: queda la URL que había; se reintenta al volver a la pestaña o en el próximo intervalo.
      }
    }
    const intervalo = window.setInterval(renovar, RENOVAR_URL_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") renovar();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", renovar);
    return () => {
      vivo = false;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", renovar);
    };
  }, [logoPath]);

  /** Cambia un campo y, si tenía error, lo limpia. */
  function poner<K extends keyof ValoresEmpresa>(campo: K, valor: string, errorDe?: keyof Errores) {
    setV((prev) => ({ ...prev, [campo]: valor }));
    if (errorDe && errores[errorDe]) setErrores((prev) => ({ ...prev, [errorDe]: undefined }));
  }

  function descartar() {
    setV(guardado);
    setErrores({});
    setError(null);
  }

  async function guardar() {
    const nuevos: Errores = {};
    // Solo se valida si cambió: un CUIT ya guardado (p. ej. el de la demo) no tiene que impedir guardar el resto.
    if (v.cuit.trim() && v.cuit.trim() !== (organizacion.cuit ?? "") && !cuitValido(v.cuit)) {
      nuevos.cuit = "El CUIT no es válido. Revisá los 11 dígitos.";
    }
    if (v.email.trim() && !EMAIL.test(v.email.trim())) nuevos.email = "Ese mail no parece válido.";
    if (v.sitioWeb.trim() && !sitioWebValido(v.sitioWeb)) {
      nuevos.sitio_web = "Poné un dominio (www.tuempresa.com.ar) o una dirección que empiece con http:// o https://.";
    }
    const dias = Number(v.validez.trim());
    if (!v.validez.trim() || !Number.isInteger(dias) || dias < 1 || dias > 365) {
      nuevos.validez = "Tiene que ser un número entero de días, entre 1 y 365.";
    }
    setErrores(nuevos);
    const primero = Object.keys(nuevos)[0] as keyof Errores | undefined;
    if (primero) {
      document.getElementById(ID_DE_ERROR[primero])?.focus();
      return;
    }

    setSaving(true);
    setError(null);
    const cuitFinal = v.cuit.trim() ? formatearCuit(v.cuit) : null;
    const { data, error: dbError } = await createClient()
      .from("organizaciones")
      .update({
        razon_social: v.razonSocial.trim() || null,
        cuit: cuitFinal,
        condicion_iva: v.condicionIva || null,
        direccion: v.direccion.trim() || null,
        telefono: v.telefono.trim() || null,
        email: v.email.trim() || null,
        sitio_web: v.sitioWeb.trim() || null,
        presupuesto_validez_dias: dias,
        presupuesto_condiciones: v.condiciones.trim() || null,
      })
      .eq("id", organizacion.id)
      .select()
      .single();
    setSaving(false);

    if (dbError || !data) {
      setError("No se pudieron guardar los datos. Revisá lo cargado e intentá de nuevo.");
      return;
    }
    if (cuitFinal) setV((prev) => ({ ...prev, cuit: cuitFinal }));
    showToast("Datos de la empresa guardados.", "success");
    router.refresh();
  }

  async function firmar(path: string) {
    const { data } = await createClient().storage.from("logos").createSignedUrl(path, VIGENCIA_URL_FIRMADA);
    return data?.signedUrl ?? null;
  }

  async function subirLogo(archivo: File) {
    setLogoError(null);
    const extension = EXTENSIONES[archivo.type];
    if (!extension) {
      setLogoError(
        archivo.type === "image/svg+xml"
          ? "El SVG no se acepta, porque puede traer código. Exportalo como PNG, JPG o WebP."
          : "El logo tiene que ser un PNG, JPG o WebP.",
      );
      return;
    }
    if (archivo.size > MAX_LOGO_BYTES) {
      setLogoError(`El logo pesa ${(archivo.size / MAX_LOGO_BYTES).toFixed(2).replace(".", ",")} MB y el máximo es 1 MB. Exportalo más liviano.`);
      return;
    }

    setLogoOcupado(true);
    const supabase = createClient();
    // Una ruta fija por organizacion: subir de nuevo pisa el archivo anterior.
    const path = `${organizacion.id}/logo.${extension}`;
    const { error: errorSubida } = await supabase.storage.from("logos").upload(path, archivo, { upsert: true, contentType: archivo.type });

    if (errorSubida) {
      setLogoOcupado(false);
      const msg = errorSubida.message.toLowerCase();
      setLogoError(
        msg.includes("maximum allowed size") || msg.includes("too large")
          ? "El logo supera el máximo de 1 MB."
          : msg.includes("mime")
            ? "El logo tiene que ser un PNG, JPG o WebP."
            : msg.includes("row-level security") || msg.includes("unauthorized")
              ? "No tenés permiso para cambiar el logo."
              : "No se pudo subir el logo. Probá de nuevo.",
      );
      return;
    }

    const { data, error: errorDb } = await supabase.from("organizaciones").update({ logo_path: path }).eq("id", organizacion.id).select().single();
    if (errorDb || !data) {
      if (logoPath === path) {
        // Misma ruta que ya estaba asociada: el archivo nuevo ya reemplazo al anterior, lo que fallo es solo el registro
        // en la empresa (que no cambia).
        setLogoUrl(await firmar(path));
        setLogoOcupado(false);
        setLogoError("El logo nuevo se subió y ya reemplazó al anterior, pero no pudimos confirmarlo en tu empresa. Recargá la página para verificarlo.");
      } else {
        setLogoOcupado(false);
        setLogoError("El archivo se subió pero no se pudo asociar a tu empresa, así que todavía no se usa en los presupuestos. Probá de nuevo.");
      }
      return;
    }

    // Si el logo anterior tenia otra extension, quedaria un archivo huerfano.
    if (logoPath && logoPath !== path) await supabase.storage.from("logos").remove([logoPath]);

    setLogoPath(path);
    setLogoUrl(await firmar(path));
    setLogoOcupado(false);
    showToast("Logo actualizado.", "success");
    router.refresh();
  }

  async function quitarLogo() {
    if (!logoPath) return;
    setLogoOcupado(true);
    setLogoError(null);
    const supabase = createClient();
    const { data, error: errorDb } = await supabase.from("organizaciones").update({ logo_path: null }).eq("id", organizacion.id).select().single();
    if (errorDb || !data) {
      setLogoOcupado(false);
      setLogoError("No se pudo quitar el logo. Probá de nuevo.");
      return;
    }

    // Primero la base y despues el archivo: si el borrado falla, queda un archivo suelto (inofensivo), no un logo
    // apuntando a la nada.
    const { data: borrados, error: errorArchivo } = await supabase.storage.from("logos").remove([logoPath]);
    setLogoOcupado(false);
    setLogoPath(null);
    setLogoUrl(null);
    if (errorArchivo || !borrados?.length) {
      showToast("Sacamos el logo de tus presupuestos, pero el archivo quedó guardado.", "warning");
    } else {
      showToast("Logo quitado.", "success");
    }
    router.refresh();
  }

  /** Si la subida o el quitado TIRAN (red caída), el botón no queda en "Procesando…": se libera y se avisa. */
  const liberarLogo = (m: string) => {
    setLogoOcupado(false);
    setLogoError(m);
  };

  const nombreEnHoja = v.razonSocial.trim() || organizacion.nombre;
  const diasVigencia = Number.isInteger(Number(v.validez)) && Number(v.validez) > 0 ? Number(v.validez) : null;

  return (
    <div className="@container min-w-0 pb-6">
      <div className="grid grid-cols-1 gap-x-12 gap-y-8 @[56rem]:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] @[84rem]:grid-cols-[minmax(0,56rem)_22rem]">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void sinTrabarse(guardar, (m) => {
              setSaving(false);
              setError(m);
            });
          }}
          className="flex min-w-0 flex-col gap-4"
        >
          <SectionBar title="Datos de la empresa" />
          {error && (
            // tabIndex -1: recibe el foco al aparecer (ver el efecto de arriba); no entra en el orden de Tab.
            <div ref={aviso} tabIndex={-1} className="scroll-mt-4 outline-none">
              <InlineBanner tone="danger">{error}</InlineBanner>
            </div>
          )}

          <Grupo titulo="Identidad fiscal" ayuda="Va en el encabezado de cada presupuesto.">
            <CampoTexto
              id="razon_social"
              label="Razón social"
              placeholder="Equipamiento Deportivo Tuco S.R.L."
              value={v.razonSocial}
              onChange={(x) => poner("razonSocial", x)}
            />
            <Par>
              <CampoTexto
                id="cuit"
                label="CUIT"
                inputMode="numeric"
                placeholder="30-12345678-9"
                value={v.cuit}
                onChange={(x) => poner("cuit", x, "cuit")}
                error={errores.cuit}
              />
              <CampoOpciones
                id="condicion_iva"
                label="Condición frente al IVA"
                value={v.condicionIva}
                onChange={(x) => poner("condicionIva", x)}
                options={[{ value: "", label: "Sin especificar" }, ...CONDICIONES_IVA]}
              />
            </Par>
            <CampoTexto
              id="direccion"
              label="Dirección"
              placeholder="Av. Siempreviva 742, Morón"
              value={v.direccion}
              onChange={(x) => poner("direccion", x)}
            />
          </Grupo>

          <Grupo titulo="Contacto" ayuda="También va en el encabezado.">
            <Par>
              <CampoTexto id="telefono" label="Teléfono" type="tel" placeholder="11 5555-1234" value={v.telefono} onChange={(x) => poner("telefono", x)} />
              <CampoTexto
                id="email"
                label="Mail"
                type="email"
                placeholder="ventas@tuempresa.com.ar"
                value={v.email}
                onChange={(x) => poner("email", x, "email")}
                error={errores.email}
              />
            </Par>
            <CampoTexto
              id="sitio_web"
              label="Sitio web"
              placeholder="www.tuempresa.com.ar"
              value={v.sitioWeb}
              onChange={(x) => poner("sitioWeb", x, "sitio_web")}
              error={errores.sitio_web}
            />
          </Grupo>

          <Grupo titulo="Presupuestos">
            <Par>
              <CampoTexto
                id="presupuesto_validez_dias"
                label="Validez (días)"
                required
                inputMode="numeric"
                placeholder="15"
                value={v.validez}
                onChange={(x) => poner("validez", x, "validez")}
                error={errores.validez}
              />
            </Par>
            <Field id="presupuesto_condiciones" label="Condiciones" help="Salen al pie de cada presupuesto. Los datos de arriba van en el encabezado.">
              {(p) => (
                <Textarea
                  {...p}
                  rows={5}
                  maxLength={2000}
                  placeholder="Forma de pago, plazo de entrega, garantía…"
                  value={v.condiciones}
                  onChange={(e) => poner("condiciones", e.target.value)}
                />
              )}
            </Field>
          </Grupo>

          {/* Una sola fila con "Guardar cambios" (el botón de siempre). Con cambios sin guardar es una barra que queda pegada
              abajo del área de trabajo mientras el formulario sigue más abajo (flotante: borde + sombra). */}
          <div
            className={cn(
              "flex flex-wrap items-center justify-end gap-2",
              sucio &&
                "sticky bottom-3 z-(--crm-z-sticky) rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) px-3 py-2 shadow-(--crm-shadow-float)",
            )}
          >
            {sucio && (
              <>
                <p className="mr-auto text-(--crm-text-2)">Cambios sin guardar</p>
                <Button variant="ghost" onClick={descartar} disabled={saving}>
                  Descartar
                </Button>
              </>
            )}
            <Button type="submit" variant="primary" icon={Save} loading={saving} className="max-sm:h-9 sm:min-w-36">
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </form>

        <div className="relative flex min-w-0 flex-col gap-6">
          <section aria-label="Logo" className="flex flex-col gap-2">
            <SectionBar title="Logo" />
            <p id="logo-ayuda" className={cn(TYPE.meta, "text-(--crm-text-2)")}>
              PNG, JPG o WebP, hasta 1 MB. Mejor con fondo transparente o blanco. El SVG no se acepta.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={inputArchivo}
                id="logo-archivo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label="Elegir el archivo del logo"
                aria-describedby="logo-ayuda"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  const archivo = e.target.files?.[0];
                  e.target.value = "";
                  if (archivo) void sinTrabarse(() => subirLogo(archivo), liberarLogo);
                }}
              />
              <Button icon={ImagePlus} loading={logoOcupado} onClick={() => inputArchivo.current?.click()} aria-describedby="logo-ayuda">
                {logoOcupado ? "Procesando…" : logoPath ? "Cambiar logo" : "Subir logo"}
              </Button>
              {logoPath && (
                <Button variant="ghost" icon={Trash2} disabled={logoOcupado} onClick={() => setQuitando(true)} className="text-(--crm-danger) hover:text-(--crm-danger)">
                  Quitar logo
                </Button>
              )}
            </div>
            {logoError && <InlineBanner tone="danger">{logoError}</InlineBanner>}
          </section>

          <section aria-label="Así va a verse en tus presupuestos" className="flex flex-col gap-2">
            <SectionBar title="Así va a verse en tus presupuestos" />
            {/* La hoja es SIEMPRE blanca, en claro y en oscuro: es un documento (como la hoja del presupuesto, `Hoja.tsx`, la
                única excepción a "solo tokens"), y un logo pensado para fondo claro no se tiene que perder sobre el tema
                oscuro. Nunca lleva la marca de Tuco & Nito: el presupuesto es de la empresa. */}
            <div className="rounded-(--crm-radius) border border-slate-300 bg-white p-4 text-slate-900">
              <div className="flex items-start gap-3">
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmada que vence: next/image no aporta nada
                  <img src={logoUrl} alt={`Logo de ${nombreEnHoja}`} className="max-h-14 w-auto max-w-32 shrink-0 object-contain" />
                )}
                <div className="min-w-0">
                  <p className="break-words text-[14px] font-semibold">{nombreEnHoja}</p>
                  {v.cuit.trim() && <p className="text-[12px] text-slate-600">CUIT {v.cuit.trim()}</p>}
                  {v.condicionIva && <p className="text-[12px] text-slate-600">{etiquetaIva(v.condicionIva)}</p>}
                  {v.direccion.trim() && <p className="break-words text-[12px] text-slate-600">{v.direccion.trim()}</p>}
                </div>
              </div>
              {diasVigencia != null && (
                <p className="mt-3 border-t border-slate-200 pt-2 text-[12px] text-slate-600">
                  Presupuesto válido por {diasVigencia} {diasVigencia === 1 ? "día" : "días"}.
                </p>
              )}
            </div>
            {!logoUrl && <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>Sin logo se imprime la razón social en texto.</p>}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={quitando}
        onClose={() => setQuitando(false)}
        onConfirm={() => sinTrabarse(quitarLogo, liberarLogo).then(() => undefined)}
        title="Quitar el logo"
        description="Tus presupuestos van a salir con la razón social en texto hasta que subas otro logo."
        confirmText="Quitar logo"
        variant="danger"
      />
    </div>
  );
}
