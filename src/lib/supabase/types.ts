// Generado con `supabase gen types typescript` (MCP de Supabase) contra el
// proyecto real. Si se agrega o modifica una tabla/columna en
// supabase/migrations/*.sql, hay que volver a generar este archivo en el
// mismo cambio.
//
// EXCEPCION: los tipos de las migraciones 0003 (productos.vida_util_meses,
// ventas, venta_items, bitacora_entradas, alertas_enviadas, la vista
// alertas_vida_util), 0004 (organizaciones, envios_auth, organizacion_id en
// todas las tablas, columnas nuevas de perfiles) y 0005 (roles, rol_id)
// estan escritos A MANO, siguiendo exactamente la forma que
// genera la herramienta. Lo mismo vale para la 0007 (origenes, motivos_perdida,
// tipos_actividad, oportunidad_etapas_historial, oportunidad_auditoria, las
// columnas nuevas de etapas, empresas, contactos, oportunidades,
// bitacora_entradas y organizaciones, y la RPC cambiar_etapa): se escribio a
// mano porque la generacion por MCP estaba bloqueada. DESVIO CONSCIENTE:
// bitacora_entradas.tipo_actividad_id es NOT NULL sin default, asi que el
// generador lo pediria en Insert; aca queda opcional porque lo completa el
// trigger bitacora_defaults y la app vieja sigue insertando solo `tipo`. Motivo: la migracion todavia no se corrio contra el
// proyecto, asi que no hay de donde generarlos. Despues de aplicar
// esas migraciones en Supabase, REGENERAR este
// archivo y pisar esta seccion — el generador es la fuente de verdad, esto es
// solo un puente para que el build compile mientras tanto.
//
// 0011 (F4, rubro): canchas, licitaciones y oportunidades.venta_item_id tambien
// estan escritos a mano (la migracion se aplica a mano, despues). Regenerar al aplicarla.
//
// 0012 (F6, presupuestos): la tabla `presupuestos` tambien esta escrita a mano (`numero` es opcional en
// Insert porque lo asigna el trigger). `presupuesto_contadores` no se tipa: la API no la ve. Regenerar al aplicarla.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      roles: {
        Row: {
          created_at: string
          descripcion: string | null
          es_admin: boolean
          id: string
          nombre: string
          organizacion_id: string
          permisos: string[]
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          es_admin?: boolean
          id?: string
          nombre: string
          organizacion_id?: string
          permisos?: string[]
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          es_admin?: boolean
          id?: string
          nombre?: string
          organizacion_id?: string
          permisos?: string[]
        }
        Relationships: []
      }
      organizaciones: {
        Row: {
          activa: boolean
          condicion_iva: string | null
          created_at: string
          cuit: string | null
          direccion: string | null
          email: string | null
          id: string
          logo_path: string | null
          nombre: string
          presupuesto_condiciones: string | null
          presupuesto_validez_dias: number
          razon_social: string | null
          sitio_web: string | null
          telefono: string | null
        }
        Insert: {
          activa?: boolean
          condicion_iva?: string | null
          created_at?: string
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          logo_path?: string | null
          nombre: string
          presupuesto_condiciones?: string | null
          presupuesto_validez_dias?: number
          razon_social?: string | null
          sitio_web?: string | null
          telefono?: string | null
        }
        Update: {
          activa?: boolean
          condicion_iva?: string | null
          created_at?: string
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          logo_path?: string | null
          nombre?: string
          presupuesto_condiciones?: string | null
          presupuesto_validez_dias?: number
          razon_social?: string | null
          sitio_web?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      envios_auth: {
        Row: {
          created_at: string
          email: string
          id: number
          tipo: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: never
          tipo: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: never
          tipo?: string
        }
        Relationships: []
      }
      contactos: {
        Row: {
          organizacion_id: string
          apellido: string | null
          cargo: string | null
          created_at: string
          documento: string | null
          email: string | null
          empresa_id: string | null
          estado: string
          id: string
          nombre: string
          notas: string | null
          origen_id: string | null
          responsable_id: string | null
          telefono: string | null
        }
        Insert: {
          organizacion_id?: string
          apellido?: string | null
          cargo?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          empresa_id?: string | null
          estado?: string
          id?: string
          nombre: string
          notas?: string | null
          origen_id?: string | null
          responsable_id?: string | null
          telefono?: string | null
        }
        Update: {
          organizacion_id?: string
          apellido?: string | null
          cargo?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          empresa_id?: string | null
          estado?: string
          id?: string
          nombre?: string
          notas?: string | null
          origen_id?: string | null
          responsable_id?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contactos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactos_origen_id_fkey"
            columns: ["organizacion_id", "origen_id"]
            isOneToOne: false
            referencedRelation: "origenes"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "contactos_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          organizacion_id: string
          created_at: string
          cuit: string | null
          direccion: string | null
          email: string | null
          estado: string
          id: string
          nombre: string
          notas: string | null
          origen_id: string | null
          responsable_id: string | null
          sitio_web: string | null
          telefono: string | null
          tipo_cliente: string | null
        }
        Insert: {
          organizacion_id?: string
          created_at?: string
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          estado?: string
          id?: string
          nombre: string
          notas?: string | null
          origen_id?: string | null
          responsable_id?: string | null
          sitio_web?: string | null
          telefono?: string | null
          tipo_cliente?: string | null
        }
        Update: {
          organizacion_id?: string
          created_at?: string
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          estado?: string
          id?: string
          nombre?: string
          notas?: string | null
          origen_id?: string | null
          responsable_id?: string | null
          sitio_web?: string | null
          telefono?: string | null
          tipo_cliente?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_origen_id_fkey"
            columns: ["organizacion_id", "origen_id"]
            isOneToOne: false
            referencedRelation: "origenes"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "empresas_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      etapas: {
        Row: {
          organizacion_id: string
          color: string | null
          id: string
          nombre: string
          orden: number
          tipo: string
        }
        Insert: {
          organizacion_id?: string
          color?: string | null
          id?: string
          nombre: string
          orden: number
          tipo?: string
        }
        Update: {
          organizacion_id?: string
          color?: string | null
          id?: string
          nombre?: string
          orden?: number
          tipo?: string
        }
        Relationships: []
      }
      oportunidades: {
        Row: {
          organizacion_id: string
          contacto_id: string | null
          created_at: string
          empresa_id: string | null
          estado: string
          etapa_id: string
          fecha_cierre: string | null
          fecha_estimada_cierre: string | null
          id: string
          monto: number | null
          motivo_perdida_id: string | null
          notas: string | null
          origen_id: string | null
          probabilidad: number | null
          producto_id: string | null
          responsable_id: string | null
          tipo: string
          titulo: string
          updated_at: string
          venta_item_id: string | null
        }
        Insert: {
          organizacion_id?: string
          contacto_id?: string | null
          created_at?: string
          empresa_id?: string | null
          estado?: string
          etapa_id: string
          fecha_cierre?: string | null
          fecha_estimada_cierre?: string | null
          id?: string
          monto?: number | null
          motivo_perdida_id?: string | null
          notas?: string | null
          origen_id?: string | null
          probabilidad?: number | null
          producto_id?: string | null
          responsable_id?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
          venta_item_id?: string | null
        }
        Update: {
          organizacion_id?: string
          contacto_id?: string | null
          created_at?: string
          empresa_id?: string | null
          estado?: string
          etapa_id?: string
          fecha_cierre?: string | null
          fecha_estimada_cierre?: string | null
          id?: string
          monto?: number | null
          motivo_perdida_id?: string | null
          notas?: string | null
          origen_id?: string | null
          probabilidad?: number | null
          producto_id?: string | null
          responsable_id?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          venta_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oportunidades_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_motivo_perdida_id_fkey"
            columns: ["organizacion_id", "motivo_perdida_id"]
            isOneToOne: false
            referencedRelation: "motivos_perdida"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "oportunidades_origen_id_fkey"
            columns: ["organizacion_id", "origen_id"]
            isOneToOne: false
            referencedRelation: "origenes"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "oportunidades_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_venta_item_id_fkey"
            columns: ["organizacion_id", "venta_item_id"]
            isOneToOne: false
            referencedRelation: "venta_items"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "oportunidades_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          activado_at: string | null
          activo: boolean
          es_superadmin: boolean
          organizacion_id: string | null
          rol_id: string | null
          created_at: string
          email: string | null
          id: string
          nombre: string | null
        }
        Insert: {
          activado_at?: string | null
          activo?: boolean
          es_superadmin?: boolean
          organizacion_id?: string | null
          rol_id?: string | null
          created_at?: string
          email?: string | null
          id: string
          nombre?: string | null
        }
        Update: {
          activado_at?: string | null
          activo?: boolean
          es_superadmin?: boolean
          organizacion_id?: string | null
          rol_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string | null
        }
        Relationships: []
      }
      productos: {
        Row: {
          organizacion_id: string
          activo: boolean
          categoria: string | null
          descripcion: string | null
          id: string
          marca: string | null
          nombre: string
          precio: number | null
          vida_util_meses: number | null
        }
        Insert: {
          organizacion_id?: string
          activo?: boolean
          categoria?: string | null
          descripcion?: string | null
          id?: string
          marca?: string | null
          nombre: string
          precio?: number | null
          vida_util_meses?: number | null
        }
        Update: {
          organizacion_id?: string
          activo?: boolean
          categoria?: string | null
          descripcion?: string | null
          id?: string
          marca?: string | null
          nombre?: string
          precio?: number | null
          vida_util_meses?: number | null
        }
        Relationships: []
      }
      ventas: {
        Row: {
          organizacion_id: string
          comprobante: string | null
          contacto_id: string | null
          created_at: string
          empresa_id: string
          fecha: string
          id: string
          notas: string | null
          oportunidad_id: string | null
        }
        Insert: {
          organizacion_id?: string
          comprobante?: string | null
          contacto_id?: string | null
          created_at?: string
          empresa_id: string
          fecha?: string
          id?: string
          notas?: string | null
          oportunidad_id?: string | null
        }
        Update: {
          organizacion_id?: string
          comprobante?: string | null
          contacto_id?: string | null
          created_at?: string
          empresa_id?: string
          fecha?: string
          id?: string
          notas?: string | null
          oportunidad_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_oportunidad_id_fkey"
            columns: ["oportunidad_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_items: {
        Row: {
          organizacion_id: string
          cantidad: number
          created_at: string
          fecha_entrega: string | null
          id: string
          precio_unitario: number | null
          producto_id: string
          venta_id: string
          vida_util_meses: number | null
        }
        Insert: {
          organizacion_id?: string
          cantidad?: number
          created_at?: string
          fecha_entrega?: string | null
          id?: string
          precio_unitario?: number | null
          producto_id: string
          venta_id: string
          vida_util_meses?: number | null
        }
        Update: {
          organizacion_id?: string
          cantidad?: number
          created_at?: string
          fecha_entrega?: string | null
          id?: string
          precio_unitario?: number | null
          producto_id?: string
          venta_id?: string
          vida_util_meses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "venta_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_items_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      bitacora_entradas: {
        Row: {
          organizacion_id: string
          autor_id: string | null
          contacto_id: string | null
          created_at: string
          detalle: string | null
          empresa_id: string | null
          id: string
          ocurrido_en: string
          oportunidad_id: string | null
          resultado: string | null
          tipo: string
          tipo_actividad_id: string
          titulo: string
        }
        Insert: {
          organizacion_id?: string
          autor_id?: string | null
          contacto_id?: string | null
          created_at?: string
          detalle?: string | null
          empresa_id?: string | null
          id?: string
          ocurrido_en?: string
          oportunidad_id?: string | null
          resultado?: string | null
          tipo?: string
          tipo_actividad_id?: string
          titulo: string
        }
        Update: {
          organizacion_id?: string
          autor_id?: string | null
          contacto_id?: string | null
          created_at?: string
          detalle?: string | null
          empresa_id?: string | null
          id?: string
          ocurrido_en?: string
          oportunidad_id?: string | null
          resultado?: string | null
          tipo?: string
          tipo_actividad_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "bitacora_entradas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bitacora_entradas_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bitacora_entradas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bitacora_entradas_oportunidad_id_fkey"
            columns: ["organizacion_id", "oportunidad_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "bitacora_entradas_tipo_actividad_id_fkey"
            columns: ["organizacion_id", "tipo_actividad_id"]
            isOneToOne: false
            referencedRelation: "tipos_actividad"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      origenes: {
        Row: {
          organizacion_id: string
          activo: boolean
          created_at: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          organizacion_id?: string
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          organizacion_id?: string
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      motivos_perdida: {
        Row: {
          organizacion_id: string
          activo: boolean
          created_at: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          organizacion_id?: string
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          organizacion_id?: string
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      tipos_actividad: {
        Row: {
          organizacion_id: string
          activo: boolean
          codigo: string | null
          created_at: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          organizacion_id?: string
          activo?: boolean
          codigo?: string | null
          created_at?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          organizacion_id?: string
          activo?: boolean
          codigo?: string | null
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      oportunidad_etapas_historial: {
        Row: {
          organizacion_id: string
          cambiado_en: string
          etapa_anterior_id: string | null
          etapa_nueva_id: string
          id: string
          observacion: string | null
          oportunidad_id: string
          usuario_id: string | null
        }
        Insert: {
          organizacion_id?: string
          cambiado_en?: string
          etapa_anterior_id?: string | null
          etapa_nueva_id: string
          id?: string
          observacion?: string | null
          oportunidad_id: string
          usuario_id?: string | null
        }
        Update: {
          organizacion_id?: string
          cambiado_en?: string
          etapa_anterior_id?: string | null
          etapa_nueva_id?: string
          id?: string
          observacion?: string | null
          oportunidad_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oportunidad_etapas_historial_etapa_anterior_id_fkey"
            columns: ["organizacion_id", "etapa_anterior_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "oportunidad_etapas_historial_etapa_nueva_id_fkey"
            columns: ["organizacion_id", "etapa_nueva_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "oportunidad_etapas_historial_oportunidad_id_fkey"
            columns: ["organizacion_id", "oportunidad_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "oportunidad_etapas_historial_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      oportunidad_auditoria: {
        Row: {
          organizacion_id: string
          cambiado_en: string
          cambios: Json
          id: string
          oportunidad_id: string
          usuario_id: string | null
        }
        Insert: {
          organizacion_id?: string
          cambiado_en?: string
          cambios: Json
          id?: string
          oportunidad_id: string
          usuario_id?: string | null
        }
        Update: {
          organizacion_id?: string
          cambiado_en?: string
          cambios?: Json
          id?: string
          oportunidad_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oportunidad_auditoria_oportunidad_id_fkey"
            columns: ["organizacion_id", "oportunidad_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "oportunidad_auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_enviadas: {
        Row: {
          organizacion_id: string
          canal: string
          destinatario: string
          enviado_at: string
          enviado_por: string | null
          id: string
          mensaje: string | null
          venta_item_id: string
        }
        Insert: {
          organizacion_id?: string
          canal: string
          destinatario: string
          enviado_at?: string
          enviado_por?: string | null
          id?: string
          mensaje?: string | null
          venta_item_id: string
        }
        Update: {
          organizacion_id?: string
          canal?: string
          destinatario?: string
          enviado_at?: string
          enviado_por?: string | null
          id?: string
          mensaje?: string | null
          venta_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_enviadas_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_enviadas_venta_item_id_fkey"
            columns: ["venta_item_id"]
            isOneToOne: false
            referencedRelation: "venta_items"
            referencedColumns: ["id"]
          },
        ]
      }
      canchas: {
        Row: {
          activa: boolean
          cantidad: number
          created_at: string
          empresa_id: string
          formato: string
          id: string
          iluminacion: boolean
          nombre: string
          notas: string | null
          organizacion_id: string
          superficie: string | null
          updated_at: string
        }
        Insert: {
          activa?: boolean
          cantidad?: number
          created_at?: string
          empresa_id: string
          formato: string
          id?: string
          iluminacion?: boolean
          nombre: string
          notas?: string | null
          organizacion_id?: string
          superficie?: string | null
          updated_at?: string
        }
        Update: {
          activa?: boolean
          cantidad?: number
          created_at?: string
          empresa_id?: string
          formato?: string
          id?: string
          iluminacion?: boolean
          nombre?: string
          notas?: string | null
          organizacion_id?: string
          superficie?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canchas_empresa_id_fkey"
            columns: ["organizacion_id", "empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      licitaciones: {
        Row: {
          created_at: string
          expediente: string | null
          fecha_apertura: string
          garantia: string | null
          id: string
          monto_oficial: number | null
          notas: string | null
          oportunidad_id: string
          organismo: string | null
          organizacion_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expediente?: string | null
          fecha_apertura: string
          garantia?: string | null
          id?: string
          monto_oficial?: number | null
          notas?: string | null
          oportunidad_id: string
          organismo?: string | null
          organizacion_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expediente?: string | null
          fecha_apertura?: string
          garantia?: string | null
          id?: string
          monto_oficial?: number | null
          notas?: string | null
          oportunidad_id?: string
          organismo?: string | null
          organizacion_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "licitaciones_oportunidad_id_fkey"
            columns: ["organizacion_id", "oportunidad_id"]
            // Escrito a mano: es 1 a 1 por el unique de `oportunidad_id` (0011). Regenerar al aplicar la migracion.
            isOneToOne: true
            referencedRelation: "oportunidades"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      presupuestos: {
        Row: {
          actividad_id: string | null
          condicion_iva: string | null
          condiciones: string | null
          created_at: string
          creado_por: string | null
          emisor: Json
          fecha: string
          id: string
          lineas: Json
          notas: string | null
          numero: number
          oportunidad_id: string
          organizacion_id: string
          total: number
          validez_dias: number
        }
        Insert: {
          actividad_id?: string | null
          condicion_iva?: string | null
          condiciones?: string | null
          created_at?: string
          creado_por?: string | null
          emisor?: Json
          fecha?: string
          id?: string
          lineas?: Json
          notas?: string | null
          // Escrito a mano: la columna es NOT NULL, pero la asigna el trigger presupuestos_numero (0012).
          numero?: number
          oportunidad_id: string
          organizacion_id?: string
          total?: number
          validez_dias?: number
        }
        Update: {
          actividad_id?: string | null
          condicion_iva?: string | null
          condiciones?: string | null
          created_at?: string
          creado_por?: string | null
          emisor?: Json
          fecha?: string
          id?: string
          lineas?: Json
          notas?: string | null
          numero?: number
          oportunidad_id?: string
          organizacion_id?: string
          total?: number
          validez_dias?: number
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_oportunidad_id_fkey"
            columns: ["organizacion_id", "oportunidad_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "presupuestos_actividad_id_fkey"
            columns: ["organizacion_id", "actividad_id"]
            isOneToOne: false
            referencedRelation: "bitacora_entradas"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
    }
    Views: {
      alertas_vida_util: {
        Row: {
          cantidad: number | null
          contacto_email: string | null
          contacto_id: string | null
          contacto_nombre: string | null
          contacto_telefono: string | null
          dias_restantes: number | null
          empresa_email: string | null
          empresa_id: string | null
          empresa_nombre: string | null
          empresa_telefono: string | null
          estado: string | null
          fecha_entrega: string | null
          producto_id: string | null
          producto_nombre: string | null
          ultimo_canal: string | null
          ultimo_envio: string | null
          vence_el: string | null
          venta_fecha: string | null
          venta_id: string | null
          venta_item_id: string | null
          vida_util_meses: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      cambiar_etapa: {
        Args: {
          p_etapa: string
          p_fecha_cierre?: string
          p_motivo_perdida?: string
          p_observacion?: string
          p_oportunidad: string
        }
        Returns: Database["public"]["Tables"]["oportunidades"]["Row"]
      }
      es_superadmin: { Args: never; Returns: boolean }
      org_actual: { Args: never; Returns: string }
      registrar_envio_auth: { Args: { p_email: string; p_tipo: string }; Returns: boolean }
      tiene_permiso: { Args: { p_permiso: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
