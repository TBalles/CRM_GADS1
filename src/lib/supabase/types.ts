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
// genera la herramienta. Motivo: la migracion todavia no se corrio contra el
// proyecto, asi que no hay de donde generarlos. Despues de aplicar
// esas migraciones en Supabase, REGENERAR este
// archivo y pisar esta seccion — el generador es la fuente de verdad, esto es
// solo un puente para que el build compile mientras tanto.

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
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          id?: string
          nombre?: string
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
          email: string | null
          empresa_id: string | null
          id: string
          nombre: string
          notas: string | null
          telefono: string | null
        }
        Insert: {
          organizacion_id?: string
          apellido?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          nombre: string
          notas?: string | null
          telefono?: string | null
        }
        Update: {
          organizacion_id?: string
          apellido?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          nombre?: string
          notas?: string | null
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
        ]
      }
      empresas: {
        Row: {
          organizacion_id: string
          created_at: string
          cuit: string | null
          direccion: string | null
          email: string | null
          id: string
          nombre: string
          notas: string | null
          telefono: string | null
        }
        Insert: {
          organizacion_id?: string
          created_at?: string
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          nombre: string
          notas?: string | null
          telefono?: string | null
        }
        Update: {
          organizacion_id?: string
          created_at?: string
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      etapas: {
        Row: {
          organizacion_id: string
          color: string | null
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          organizacion_id?: string
          color?: string | null
          id?: string
          nombre: string
          orden: number
        }
        Update: {
          organizacion_id?: string
          color?: string | null
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      oportunidades: {
        Row: {
          organizacion_id: string
          contacto_id: string | null
          created_at: string
          empresa_id: string | null
          etapa_id: string
          id: string
          monto: number | null
          notas: string | null
          producto_id: string | null
          responsable_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          organizacion_id?: string
          contacto_id?: string | null
          created_at?: string
          empresa_id?: string | null
          etapa_id: string
          id?: string
          monto?: number | null
          notas?: string | null
          producto_id?: string | null
          responsable_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          organizacion_id?: string
          contacto_id?: string | null
          created_at?: string
          empresa_id?: string | null
          etapa_id?: string
          id?: string
          monto?: number | null
          notas?: string | null
          producto_id?: string | null
          responsable_id?: string | null
          titulo?: string
          updated_at?: string
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
            foreignKeyName: "oportunidades_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
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
          empresa_id: string
          id: string
          ocurrido_en: string
          tipo: string
          titulo: string
        }
        Insert: {
          organizacion_id?: string
          autor_id?: string | null
          contacto_id?: string | null
          created_at?: string
          detalle?: string | null
          empresa_id: string
          id?: string
          ocurrido_en?: string
          tipo?: string
          titulo: string
        }
        Update: {
          organizacion_id?: string
          autor_id?: string | null
          contacto_id?: string | null
          created_at?: string
          detalle?: string | null
          empresa_id?: string
          id?: string
          ocurrido_en?: string
          tipo?: string
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
