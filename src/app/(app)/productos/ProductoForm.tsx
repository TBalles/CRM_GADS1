"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Campo,
  CampoGrupo,
  CampoMoney,
  CampoTextarea,
  FormActions,
  FormBanner,
} from "@/components/form";
import { useToast } from "@/components/ui/Toast";
import { maskFromNumber, parseMoney } from "@/lib/money";
import type { Tables } from "@/lib/supabase/types";

type Producto = Tables<"productos">;

/** Postgres: violacion de restriccion unica. `productos.nombre` es unique. */
const UNIQUE_VIOLATION = "23505";

export default function ProductoForm({
  producto,
  onSaved,
  onCancel,
}: {
  producto?: Producto;
  onSaved: (producto: Producto) => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [marca, setMarca] = useState(producto?.marca ?? "");
  const [categoria, setCategoria] = useState(producto?.categoria ?? "");
  const [precio, setPrecio] = useState(
    maskFromNumber(producto?.precio),
  );
  const [vidaUtil, setVidaUtil] = useState(
    producto?.vida_util_meses != null ? String(producto.vida_util_meses) : "",
  );
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? "");
  const [nombreError, setNombreError] = useState<string | null>(null);
  const [vidaUtilError, setVidaUtilError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!nombre.trim()) {
      setNombreError("El nombre es obligatorio.");
      return;
    }

    // La vida util es opcional, pero si se carga tiene que ser un entero
    // positivo: la base tiene un CHECK y rechazaria 0 o negativos con un error
    // feo. Mejor decirlo acá, donde se puede corregir.
    const vidaUtilLimpia = vidaUtil.trim();
    let vidaUtilMeses: number | null = null;
    if (vidaUtilLimpia) {
      const n = Number(vidaUtilLimpia);
      if (!Number.isInteger(n) || n <= 0) {
        setVidaUtilError("Tiene que ser un número entero de meses mayor a 0.");
        return;
      }
      vidaUtilMeses = n;
    }

    setNombreError(null);
    setVidaUtilError(null);
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const payload = {
      nombre: nombre.trim(),
      marca: marca.trim() || null,
      categoria: categoria.trim() || null,
      // parseMoney devuelve 0 para vacio; un producto sin precio cargado es
      // null, no $0. Son cosas distintas y la tabla las muestra distinto.
      precio: precio.trim() ? parseMoney(precio) : null,
      vida_util_meses: vidaUtilMeses,
      descripcion: descripcion.trim() || null,
    };

    const { data, error: dbError } = producto
      ? await supabase.from("productos").update(payload).eq("id", producto.id).select().single()
      : await supabase.from("productos").insert(payload).select().single();

    setSaving(false);

    if (dbError || !data) {
      // Un nombre repetido es un error del usuario, no del sistema: merece un
      // mensaje que diga qué corregir, no un "algo salió mal".
      if (dbError?.code === UNIQUE_VIOLATION) {
        setNombreError("Ya existe un producto con ese nombre.");
        return;
      }
      setError("No se pudo guardar el producto. Revisá los datos e intentá de nuevo.");
      return;
    }

    showToast(producto ? "Producto actualizado." : "Producto creado.", "success");
    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <FormBanner message={error} />}

      <Campo
        id="nombre"
        label="Nombre"
        required
        autoFocus
        placeholder="Red de arco 7.32 × 2.44"
        value={nombre}
        onChange={(v) => {
          setNombre(v);
          if (nombreError) setNombreError(null);
        }}
        error={nombreError ?? undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo id="marca" label="Marca" placeholder="Genérica" value={marca} onChange={setMarca} />
        <Campo
          id="categoria"
          label="Categoría"
          placeholder="Arcos, redes, conos…"
          value={categoria}
          onChange={setCategoria}
        />
      </div>

      <CampoMoney id="precio" label="Precio de lista" value={precio} onChange={setPrecio} />

      <CampoGrupo title="Seguimiento de recambio">
        <Campo
          id="vida_util_meses"
          label="Duración estimada (meses)"
          inputMode="numeric"
          placeholder="24"
          value={vidaUtil}
          onChange={(v) => {
            setVidaUtil(v);
            if (vidaUtilError) setVidaUtilError(null);
          }}
          error={vidaUtilError ?? undefined}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Cuando este producto se venda, el sistema va a contar estos meses desde la fecha de
          entrega y va a avisarte 60 días antes de que se cumpla. Dejalo vacío si este producto no
          lleva seguimiento de recambio.
        </p>
      </CampoGrupo>

      <CampoTextarea
        id="descripcion"
        label="Descripción"
        placeholder="Material, medidas, detalles técnicos…"
        value={descripcion}
        onChange={setDescripcion}
      />

      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  );
}
