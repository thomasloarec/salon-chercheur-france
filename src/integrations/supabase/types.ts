export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
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
      application_logs: {
        Row: {
          created_at: string
          details: Json | null
          function_name: string | null
          id: string
          ip_address: string | null
          level: string
          message: string
          source: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          function_name?: string | null
          id?: string
          ip_address?: string | null
          level: string
          message: string
          source: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          function_name?: string | null
          id?: string
          ip_address?: string | null
          level?: string
          message?: string
          source?: string
          user_agent?: string | null
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
      csrf_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          user_id?: string
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
            referencedColumns: ["id_event"]
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
          affluence: string | null
          airtable_id: string | null
          code_postal: string | null
          created_at: string | null
          date_debut: string | null
          date_fin: string | null
          description_event: string | null
          id: string
          id_event: string
          is_b2b: boolean
          location: string | null
          nom_event: string
          nom_lieu: string | null
          pays: string | null
          rue: string | null
          secteur: Json | null
          slug: string | null
          status_event: string | null
          tarif: string | null
          type_event: string | null
          updated_at: string | null
          url_image: string | null
          url_site_officiel: string | null
          ville: string | null
          visible: boolean | null
        }
        Insert: {
          affluence?: string | null
          airtable_id?: string | null
          code_postal?: string | null
          created_at?: string | null
          date_debut?: string | null
          date_fin?: string | null
          description_event?: string | null
          id?: string
          id_event: string
          is_b2b?: boolean
          location?: string | null
          nom_event: string
          nom_lieu?: string | null
          pays?: string | null
          rue?: string | null
          secteur?: Json | null
          slug?: string | null
          status_event?: string | null
          tarif?: string | null
          type_event?: string | null
          updated_at?: string | null
          url_image?: string | null
          url_site_officiel?: string | null
          ville?: string | null
          visible?: boolean | null
        }
        Update: {
          affluence?: string | null
          airtable_id?: string | null
          code_postal?: string | null
          created_at?: string | null
          date_debut?: string | null
          date_fin?: string | null
          description_event?: string | null
          id?: string
          id_event?: string
          is_b2b?: boolean
          location?: string | null
          nom_event?: string
          nom_lieu?: string | null
          pays?: string | null
          rue?: string | null
          secteur?: Json | null
          slug?: string | null
          status_event?: string | null
          tarif?: string | null
          type_event?: string | null
          updated_at?: string | null
          url_image?: string | null
          url_site_officiel?: string | null
          ville?: string | null
          visible?: boolean | null
        }
        Relationships: []
      }
      events_import_old: {
        Row: {
          adresse: string | null
          affluence: string | null
          ai_certainty: string | null
          airtable_id: string | null
          chatgpt_prompt: string | null
          code_postal: string | null
          created_at: string | null
          date_complete: string | null
          date_debut: string | null
          date_fin: string | null
          description_event: string | null
          id: string
          nom_event: string | null
          nom_lieu: string | null
          rue: string | null
          secteur: string | null
          status_event: string | null
          tarif: string | null
          type_event: string | null
          updated_at: string | null
          url_image: string | null
          url_site_officiel: string | null
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          affluence?: string | null
          ai_certainty?: string | null
          airtable_id?: string | null
          chatgpt_prompt?: string | null
          code_postal?: string | null
          created_at?: string | null
          date_complete?: string | null
          date_debut?: string | null
          date_fin?: string | null
          description_event?: string | null
          id: string
          nom_event?: string | null
          nom_lieu?: string | null
          rue?: string | null
          secteur?: string | null
          status_event?: string | null
          tarif?: string | null
          type_event?: string | null
          updated_at?: string | null
          url_image?: string | null
          url_site_officiel?: string | null
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          affluence?: string | null
          ai_certainty?: string | null
          airtable_id?: string | null
          chatgpt_prompt?: string | null
          code_postal?: string | null
          created_at?: string | null
          date_complete?: string | null
          date_debut?: string | null
          date_fin?: string | null
          description_event?: string | null
          id?: string
          nom_event?: string | null
          nom_lieu?: string | null
          rue?: string | null
          secteur?: string | null
          status_event?: string | null
          tarif?: string | null
          type_event?: string | null
          updated_at?: string | null
          url_image?: string | null
          url_site_officiel?: string | null
          ville?: string | null
        }
        Relationships: []
      }
      events_old: {
        Row: {
          affluence: number | null
          airtable_id: string | null
          code_postal: string | null
          created_at: string
          date_debut: string
          date_fin: string
          description_event: string | null
          estimated_exhibitors: number | null
          event_url: string | null
          id: string
          id_event: string | null
          is_b2b: boolean | null
          last_scraped_at: string | null
          location: string
          nom_event: string
          nom_lieu: string | null
          organizer_contact: string | null
          organizer_name: string | null
          pays: string | null
          rue: string | null
          scraped_from: string | null
          secteur: Json
          slug: string | null
          tags: string[] | null
          tarif: string | null
          type_event: string
          updated_at: string
          url_image: string | null
          url_site_officiel: string | null
          ville: string
          visible: boolean | null
        }
        Insert: {
          affluence?: number | null
          airtable_id?: string | null
          code_postal?: string | null
          created_at?: string
          date_debut: string
          date_fin: string
          description_event?: string | null
          estimated_exhibitors?: number | null
          event_url?: string | null
          id?: string
          id_event?: string | null
          is_b2b?: boolean | null
          last_scraped_at?: string | null
          location: string
          nom_event: string
          nom_lieu?: string | null
          organizer_contact?: string | null
          organizer_name?: string | null
          pays?: string | null
          rue?: string | null
          scraped_from?: string | null
          secteur: Json
          slug?: string | null
          tags?: string[] | null
          tarif?: string | null
          type_event?: string
          updated_at?: string
          url_image?: string | null
          url_site_officiel?: string | null
          ville: string
          visible?: boolean | null
        }
        Update: {
          affluence?: number | null
          airtable_id?: string | null
          code_postal?: string | null
          created_at?: string
          date_debut?: string
          date_fin?: string
          description_event?: string | null
          estimated_exhibitors?: number | null
          event_url?: string | null
          id?: string
          id_event?: string | null
          is_b2b?: boolean | null
          last_scraped_at?: string | null
          location?: string
          nom_event?: string
          nom_lieu?: string | null
          organizer_contact?: string | null
          organizer_name?: string | null
          pays?: string | null
          rue?: string | null
          scraped_from?: string | null
          secteur?: Json
          slug?: string | null
          tags?: string[] | null
          tarif?: string | null
          type_event?: string
          updated_at?: string
          url_image?: string | null
          url_site_officiel?: string | null
          ville?: string
          visible?: boolean | null
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
            referencedRelation: "events_old"
            referencedColumns: ["id"]
          },
        ]
      }
      exposants: {
        Row: {
          created_at: string | null
          exposant_description: string | null
          id: number
          id_exposant: string | null
          nom_exposant: string | null
          website_exposant: string | null
        }
        Insert: {
          created_at?: string | null
          exposant_description?: string | null
          id?: number
          id_exposant?: string | null
          nom_exposant?: string | null
          website_exposant?: string | null
        }
        Update: {
          created_at?: string | null
          exposant_description?: string | null
          id?: number
          id_exposant?: string | null
          nom_exposant?: string | null
          website_exposant?: string | null
        }
        Relationships: []
      }
      exposants_backup_20250101: {
        Row: {
          created_at: string | null
          exposant_description: string | null
          id: number | null
          id_exposant: string | null
          nom_exposant: string | null
          website_exposant: string | null
        }
        Insert: {
          created_at?: string | null
          exposant_description?: string | null
          id?: number | null
          id_exposant?: string | null
          nom_exposant?: string | null
          website_exposant?: string | null
        }
        Update: {
          created_at?: string | null
          exposant_description?: string | null
          id?: number | null
          id_exposant?: string | null
          nom_exposant?: string | null
          website_exposant?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          event_id: string
          event_uuid: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_uuid: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_uuid?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_event_fkey"
            columns: ["event_uuid"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_event_fkey"
            columns: ["event_uuid"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
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
      participation: {
        Row: {
          created_at: string | null
          id_event: string | null
          id_exposant: string
          id_participation: string
          stand_exposant: string | null
          urlexpo_event: string | null
          website_exposant: string | null
        }
        Insert: {
          created_at?: string | null
          id_event?: string | null
          id_exposant: string
          id_participation?: string
          stand_exposant?: string | null
          urlexpo_event?: string | null
          website_exposant?: string | null
        }
        Update: {
          created_at?: string | null
          id_event?: string | null
          id_exposant?: string
          id_participation?: string
          stand_exposant?: string | null
          urlexpo_event?: string | null
          website_exposant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_participation_event"
            columns: ["id_event"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_participation_event"
            columns: ["id_event"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participation_id_exposant_fkey"
            columns: ["id_exposant"]
            isOneToOne: false
            referencedRelation: "exposants"
            referencedColumns: ["id_exposant"]
          },
        ]
      }
      participation_backup_20250101: {
        Row: {
          created_at: string | null
          id_event: string | null
          id_exposant: string | null
          id_participation: string | null
          stand_exposant: string | null
          urlexpo_event: string | null
          website_exposant: string | null
        }
        Insert: {
          created_at?: string | null
          id_event?: string | null
          id_exposant?: string | null
          id_participation?: string | null
          stand_exposant?: string | null
          urlexpo_event?: string | null
          website_exposant?: string | null
        }
        Update: {
          created_at?: string | null
          id_event?: string | null
          id_exposant?: string | null
          id_participation?: string | null
          stand_exposant?: string | null
          urlexpo_event?: string | null
          website_exposant?: string | null
        }
        Relationships: []
      }
      participation_import_errors: {
        Row: {
          created_at: string | null
          id_event: string | null
          nom_exposant: string | null
          reason: string
          record_id: string
          stand_exposant: string | null
          urlexpo_event: string | null
          website_exposant: string | null
        }
        Insert: {
          created_at?: string | null
          id_event?: string | null
          nom_exposant?: string | null
          reason: string
          record_id: string
          stand_exposant?: string | null
          urlexpo_event?: string | null
          website_exposant?: string | null
        }
        Update: {
          created_at?: string | null
          id_event?: string | null
          nom_exposant?: string | null
          reason?: string
          record_id?: string
          stand_exposant?: string | null
          urlexpo_event?: string | null
          website_exposant?: string | null
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
          role: Database["public"]["Enums"]["app_role"] | null
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
          role?: Database["public"]["Enums"]["app_role"] | null
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
          role?: Database["public"]["Enums"]["app_role"] | null
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
      staging_events_import: {
        Row: {
          affluence: string | null
          airtable_id: string | null
          code_postal: string | null
          created_at: string | null
          date_debut: string | null
          date_fin: string | null
          description_event: string | null
          id: string | null
          id_event: string
          is_b2b: boolean | null
          location: string | null
          nom_event: string | null
          nom_lieu: string | null
          pays: string | null
          rue: string | null
          secteur: string[] | null
          status_event: string | null
          tarif: string | null
          type_event: string | null
          updated_at: string
          url_image: string | null
          url_site_officiel: string | null
          ville: string | null
          visible: boolean | null
        }
        Insert: {
          affluence?: string | null
          airtable_id?: string | null
          code_postal?: string | null
          created_at?: string | null
          date_debut?: string | null
          date_fin?: string | null
          description_event?: string | null
          id?: string | null
          id_event: string
          is_b2b?: boolean | null
          location?: string | null
          nom_event?: string | null
          nom_lieu?: string | null
          pays?: string | null
          rue?: string | null
          secteur?: string[] | null
          status_event?: string | null
          tarif?: string | null
          type_event?: string | null
          updated_at?: string
          url_image?: string | null
          url_site_officiel?: string | null
          ville?: string | null
          visible?: boolean | null
        }
        Update: {
          affluence?: string | null
          airtable_id?: string | null
          code_postal?: string | null
          created_at?: string | null
          date_debut?: string | null
          date_fin?: string | null
          description_event?: string | null
          id?: string | null
          id_event?: string
          is_b2b?: boolean | null
          location?: string | null
          nom_event?: string | null
          nom_lieu?: string | null
          pays?: string | null
          rue?: string | null
          secteur?: string[] | null
          status_event?: string | null
          tarif?: string | null
          type_event?: string | null
          updated_at?: string
          url_image?: string | null
          url_site_officiel?: string | null
          ville?: string | null
          visible?: boolean | null
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
          access_token_enc: string
          created_at: string | null
          expires_at: string | null
          id: string
          provider: string
          refresh_token_enc: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token_enc: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          provider: string
          refresh_token_enc?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token_enc?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          provider?: string
          refresh_token_enc?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      events_geo: {
        Row: {
          code_postal: string | null
          dep_code: string | null
          id: string | null
          region_code: string | null
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
    }
    Functions: {
      cleanup_expired_csrf_tokens: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
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
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
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
      get_user_crm_matches: {
        Args: { p_user_id: string }
        Returns: {
          company_id: string
          company_name: string
          company_website: string
          provider: string
          events_count: number
          upcoming_events: Json
        }[]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      log_application_event: {
        Args: {
          p_level: string
          p_message: string
          p_details?: Json
          p_source?: string
          p_function_name?: string
          p_user_id?: string
          p_ip_address?: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      publish_pending_event_atomic: {
        Args: { p_id_event: string; p_event_data: Json }
        Returns: Json
      }
      search_events: {
        Args: {
          sector_ids?: string[]
          event_types?: string[]
          months?: number[]
          region_codes?: string[]
          page_num?: number
          page_size?: number
        }
        Returns: {
          id: string
          id_event: string
          nom_event: string
          date_debut: string
          date_fin: string
          ville: string
          secteur: Json
          url_image: string
          slug: string
          rue: string
          code_postal: string
          nom_lieu: string
          url_site_officiel: string
          type_event: string
          is_b2b: boolean
          visible: boolean
          total_count: number
        }[]
      }
      search_events_test: {
        Args: {
          sector_ids?: string[]
          event_types?: string[]
          months?: number[]
          region_codes?: string[]
          page_num?: number
          page_size?: number
        }
        Returns: string[]
      }
      toggle_favorite: {
        Args: { p_event: string }
        Returns: undefined
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
      app_role: "admin" | "moderator" | "user"
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
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
