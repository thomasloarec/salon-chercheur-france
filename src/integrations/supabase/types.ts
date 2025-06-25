export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      alerts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          keywords: string[] | null
          last_sent_at: string | null
          location_filter: string | null
          sector_filter: string | null
          user_email: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          last_sent_at?: string | null
          location_filter?: string | null
          sector_filter?: string | null
          user_email: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          last_sent_at?: string | null
          location_filter?: string | null
          sector_filter?: string | null
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      communes: {
        Row: {
          code_postal: string | null
          created_at: string | null
          dep_code: string | null
          id: number
          nom: string
          region_code: string | null
        }
        Insert: {
          code_postal?: string | null
          created_at?: string | null
          dep_code?: string | null
          id?: number
          nom: string
          region_code?: string | null
        }
        Update: {
          code_postal?: string | null
          created_at?: string | null
          dep_code?: string | null
          id?: number
          nom?: string
          region_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communes_dep_code_fkey"
            columns: ["dep_code"]
            isOneToOne: false
            referencedRelation: "departements"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "communes_region_code_fkey"
            columns: ["region_code"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["code"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string | null
          id: string
          name: string
          siret: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          siret?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          siret?: string | null
          website?: string | null
        }
        Relationships: []
      }
      departements: {
        Row: {
          code: string
          created_at: string | null
          nom: string
          region_code: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          nom: string
          region_code?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          nom?: string
          region_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departements_region_code_fkey"
            columns: ["region_code"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["code"]
          },
        ]
      }
      event_exhibitors: {
        Row: {
          company_id: string
          event_id: string
          scraped_at: string | null
          source_url: string | null
          stand: string | null
        }
        Insert: {
          company_id: string
          event_id: string
          scraped_at?: string | null
          source_url?: string | null
          stand?: string | null
        }
        Update: {
          company_id?: string
          event_id?: string
          scraped_at?: string | null
          source_url?: string | null
          stand?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_exhibitors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_exhibitors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_exhibitors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sectors: {
        Row: {
          created_at: string
          event_id: string
          sector_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          sector_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          sector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_sectors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sectors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sectors_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          city: string
          country: string | null
          created_at: string
          description: string | null
          end_date: string
          entry_fee: string | null
          estimated_exhibitors: number | null
          estimated_visitors: number | null
          event_type: string
          event_url: string | null
          id: string
          image_url: string | null
          is_b2b: boolean | null
          last_scraped_at: string | null
          location: string
          name: string
          organizer_contact: string | null
          organizer_name: string | null
          postal_code: string | null
          region: string | null
          scraped_from: string | null
          sector: string
          slug: string | null
          start_date: string
          tags: string[] | null
          updated_at: string
          venue_name: string | null
          visible: boolean | null
          website_url: string | null
        }
        Insert: {
          address?: string | null
          city: string
          country?: string | null
          created_at?: string
          description?: string | null
          end_date: string
          entry_fee?: string | null
          estimated_exhibitors?: number | null
          estimated_visitors?: number | null
          event_type?: string
          event_url?: string | null
          id?: string
          image_url?: string | null
          is_b2b?: boolean | null
          last_scraped_at?: string | null
          location: string
          name: string
          organizer_contact?: string | null
          organizer_name?: string | null
          postal_code?: string | null
          region?: string | null
          scraped_from?: string | null
          sector: string
          slug?: string | null
          start_date: string
          tags?: string[] | null
          updated_at?: string
          venue_name?: string | null
          visible?: boolean | null
          website_url?: string | null
        }
        Update: {
          address?: string | null
          city?: string
          country?: string | null
          created_at?: string
          description?: string | null
          end_date?: string
          entry_fee?: string | null
          estimated_exhibitors?: number | null
          estimated_visitors?: number | null
          event_type?: string
          event_url?: string | null
          id?: string
          image_url?: string | null
          is_b2b?: boolean | null
          last_scraped_at?: string | null
          location?: string
          name?: string
          organizer_contact?: string | null
          organizer_name?: string | null
          postal_code?: string | null
          region?: string | null
          scraped_from?: string | null
          sector?: string
          slug?: string | null
          start_date?: string
          tags?: string[] | null
          updated_at?: string
          venue_name?: string | null
          visible?: boolean | null
          website_url?: string | null
        }
        Relationships: []
      }
      exhibitor_matches: {
        Row: {
          company_id: string | null
          created_at: string | null
          event_id: string | null
          id: string
          relation: string | null
          stand: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          relation?: string | null
          stand?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          relation?: string | null
          stand?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exhibitor_matches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscriptions: {
        Row: {
          created_at: string
          email: string
          id: string
          sectors: string[]
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          sectors: string[]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          sectors?: string[]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string
          first_name: string | null
          id: string
          job_title: string | null
          last_name: string | null
          primary_sector: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          primary_sector?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          primary_sector?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_primary_sector_fkey"
            columns: ["primary_sector"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          code: string
          created_at: string | null
          nom: string
        }
        Insert: {
          code: string
          created_at?: string | null
          nom: string
        }
        Update: {
          code?: string
          created_at?: string | null
          nom?: string
        }
        Relationships: []
      }
      scraping_sources: {
        Row: {
          base_url: string
          created_at: string
          id: string
          is_active: boolean | null
          last_scraped_at: string | null
          name: string
          scraping_frequency_days: number | null
        }
        Insert: {
          base_url: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_scraped_at?: string | null
          name: string
          scraping_frequency_days?: number | null
        }
        Update: {
          base_url?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_scraped_at?: string | null
          name?: string
          scraping_frequency_days?: number | null
        }
        Relationships: []
      }
      sectors: {
        Row: {
          created_at: string
          description: string | null
          id: string
          keywords: string[] | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          keywords?: string[] | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          keywords?: string[] | null
          name?: string
        }
        Relationships: []
      }
      user_companies: {
        Row: {
          company_id: string
          created_at: string | null
          relation: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          relation?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          relation?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_crm_companies: {
        Row: {
          company_id: string
          created_at: string | null
          external_id: string
          id: string
          last_synced_at: string | null
          provider: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          external_id: string
          id?: string
          last_synced_at?: string | null
          provider: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          external_id?: string
          id?: string
          last_synced_at?: string | null
          provider?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_crm_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_crm_connections: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string | null
          id: string
          provider: string
          refresh_token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          provider: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          provider?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      events_geo: {
        Row: {
          address: string | null
          city: string | null
          commune_id: number | null
          country: string | null
          created_at: string | null
          dep_code: string | null
          description: string | null
          end_date: string | null
          entry_fee: string | null
          estimated_exhibitors: number | null
          estimated_visitors: number | null
          event_type: string | null
          event_url: string | null
          id: string | null
          image_url: string | null
          is_b2b: boolean | null
          last_scraped_at: string | null
          location: string | null
          name: string | null
          organizer_contact: string | null
          organizer_name: string | null
          postal_code: string | null
          region: string | null
          region_code: string | null
          scraped_from: string | null
          sector: string | null
          slug: string | null
          start_date: string | null
          tags: string[] | null
          updated_at: string | null
          venue_name: string | null
          visible: boolean | null
          website_url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communes_dep_code_fkey"
            columns: ["dep_code"]
            isOneToOne: false
            referencedRelation: "departements"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "departements_region_code_fkey"
            columns: ["region_code"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Functions: {
      delete_user_account: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      export_user_data: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      generate_event_slug: {
        Args: { event_name: string; event_city: string; event_year: number }
        Returns: string
      }
      get_location_suggestions: {
        Args: { q: string }
        Returns: {
          rank: number
          type: string
          label: string
          value: string
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      search_events: {
        Args: {
          location_type?: string
          location_value?: string
          sector_ids?: string[]
          event_types?: string[]
          months?: number[]
          page_num?: number
          page_size?: number
        }
        Returns: {
          id: string
          name: string
          description: string
          start_date: string
          end_date: string
          sector: string
          location: string
          city: string
          region: string
          country: string
          venue_name: string
          event_url: string
          image_url: string
          tags: string[]
          organizer_name: string
          organizer_contact: string
          entry_fee: string
          estimated_visitors: number
          estimated_exhibitors: number
          is_b2b: boolean
          event_type: string
          created_at: string
          updated_at: string
          last_scraped_at: string
          scraped_from: string
          address: string
          visible: boolean
          slug: string
          total_count: number
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      toggle_favorite: {
        Args: { p_event: string }
        Returns: undefined
      }
      unaccent: {
        Args: { "": string }
        Returns: string
      }
      unaccent_init: {
        Args: { "": unknown }
        Returns: unknown
      }
      update_existing_events_slugs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_user_password: {
        Args: { current_password: string; new_password: string }
        Returns: Json
      }
    }
    Enums: {
      event_type_enum:
        | "salon"
        | "convention"
        | "congres"
        | "conference"
        | "ceremonie"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      event_type_enum: [
        "salon",
        "convention",
        "congres",
        "conference",
        "ceremonie",
      ],
    },
  },
} as const
