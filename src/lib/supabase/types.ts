// Tipos de la base escritos a mano (no hay `supabase gen types` corrido
// contra un proyecto real todavía). Alcanza con Row/Insert/Update y las
// Relationships de las FK que se usan en selects con embeds
// (`oportunidades.select('etapa:etapas(...)')` y similares) para que
// supabase-js infiera esos embeds como objeto y no como array.

export type Database = {
  public: {
    Tables: {
      perfiles: {
        Row: {
          id: string;
          nombre: string | null;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          nombre?: string | null;
          email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string | null;
          email?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      empresas: {
        Row: {
          id: string;
          nombre: string;
          cuit: string | null;
          telefono: string | null;
          email: string | null;
          direccion: string | null;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          cuit?: string | null;
          telefono?: string | null;
          email?: string | null;
          direccion?: string | null;
          notas?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          cuit?: string | null;
          telefono?: string | null;
          email?: string | null;
          direccion?: string | null;
          notas?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      contactos: {
        Row: {
          id: string;
          empresa_id: string | null;
          nombre: string;
          apellido: string | null;
          email: string | null;
          telefono: string | null;
          cargo: string | null;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          empresa_id?: string | null;
          nombre: string;
          apellido?: string | null;
          email?: string | null;
          telefono?: string | null;
          cargo?: string | null;
          notas?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          empresa_id?: string | null;
          nombre?: string;
          apellido?: string | null;
          email?: string | null;
          telefono?: string | null;
          cargo?: string | null;
          notas?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contactos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      productos: {
        Row: {
          id: string;
          nombre: string;
          descripcion: string | null;
          precio: number | null;
          categoria: string | null;
          activo: boolean;
        };
        Insert: {
          id?: string;
          nombre: string;
          descripcion?: string | null;
          precio?: number | null;
          categoria?: string | null;
          activo?: boolean;
        };
        Update: {
          id?: string;
          nombre?: string;
          descripcion?: string | null;
          precio?: number | null;
          categoria?: string | null;
          activo?: boolean;
        };
        Relationships: [];
      };
      etapas: {
        Row: {
          id: string;
          nombre: string;
          orden: number;
          color: string | null;
        };
        Insert: {
          id?: string;
          nombre: string;
          orden: number;
          color?: string | null;
        };
        Update: {
          id?: string;
          nombre?: string;
          orden?: number;
          color?: string | null;
        };
        Relationships: [];
      };
      oportunidades: {
        Row: {
          id: string;
          titulo: string;
          empresa_id: string | null;
          contacto_id: string | null;
          producto_id: string | null;
          responsable_id: string | null;
          etapa_id: string;
          monto: number | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          titulo: string;
          empresa_id?: string | null;
          contacto_id?: string | null;
          producto_id?: string | null;
          responsable_id?: string | null;
          etapa_id: string;
          monto?: number | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          titulo?: string;
          empresa_id?: string | null;
          contacto_id?: string | null;
          producto_id?: string | null;
          responsable_id?: string | null;
          etapa_id?: string;
          monto?: number | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oportunidades_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oportunidades_contacto_id_fkey";
            columns: ["contacto_id"];
            isOneToOne: false;
            referencedRelation: "contactos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oportunidades_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oportunidades_responsable_id_fkey";
            columns: ["responsable_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oportunidades_etapa_id_fkey";
            columns: ["etapa_id"];
            isOneToOne: false;
            referencedRelation: "etapas";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
