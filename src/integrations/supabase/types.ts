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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_data_cleaning_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          airtable_sync_required: boolean
          created_at: string
          entity_id: string | null
          entity_name: string | null
          entity_source: string | null
          entity_type: string
          id: string
          impact: Json | null
          new_values: Json | null
          old_values: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          airtable_sync_required?: boolean
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_source?: string | null
          entity_type?: string
          id?: string
          impact?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          airtable_sync_required?: boolean
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_source?: string | null
          entity_type?: string
          id?: string
          impact?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      alerts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          keywords: string[] | null
          last_sent_at: string | null
          location_filter: string | null
          sector_filter: string | null
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
      blog_articles: {
        Row: {
          body_text: string | null
          created_at: string | null
          created_by: string | null
          event_ids: Json | null
          faq: Json | null
          h1_title: string | null
          header_image_url: string | null
          id: string
          intro_text: string | null
          is_auto_generated: boolean | null
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          sector_slug: string | null
          slug: string
          status: string
          target_month: string | null
          title: string
          updated_at: string | null
          why_visit_text: string | null
        }
        Insert: {
          body_text?: string | null
          created_at?: string | null
          created_by?: string | null
          event_ids?: Json | null
          faq?: Json | null
          h1_title?: string | null
          header_image_url?: string | null
          id?: string
          intro_text?: string | null
          is_auto_generated?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          sector_slug?: string | null
          slug: string
          status?: string
          target_month?: string | null
          title: string
          updated_at?: string | null
          why_visit_text?: string | null
        }
        Update: {
          body_text?: string | null
          created_at?: string | null
          created_by?: string | null
          event_ids?: Json | null
          faq?: Json | null
          h1_title?: string | null
          header_image_url?: string | null
          id?: string
          intro_text?: string | null
          is_auto_generated?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          sector_slug?: string | null
          slug?: string
          status?: string
          target_month?: string | null
          title?: string
          updated_at?: string | null
          why_visit_text?: string | null
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
      crm_companies: {
        Row: {
          company_name: string
          created_at: string | null
          crm_status: string | null
          id: string
          import_id: string | null
          is_monitored: boolean | null
          normalized_domain: string | null
          notes: string | null
          owner_email: string | null
          owner_name: string | null
          updated_at: string | null
          user_id: string
          website_raw: string | null
        }
        Insert: {
          company_name: string
          created_at?: string | null
          crm_status?: string | null
          id?: string
          import_id?: string | null
          is_monitored?: boolean | null
          normalized_domain?: string | null
          notes?: string | null
          owner_email?: string | null
          owner_name?: string | null
          updated_at?: string | null
          user_id: string
          website_raw?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string | null
          crm_status?: string | null
          id?: string
          import_id?: string | null
          is_monitored?: boolean | null
          normalized_domain?: string | null
          notes?: string | null
          owner_email?: string | null
          owner_name?: string | null
          updated_at?: string | null
          user_id?: string
          website_raw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_companies_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "crm_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_company_event_matches: {
        Row: {
          created_at: string | null
          crm_company_id: string
          event_id: string
          id: string
          id_exposant: string
          match_status: string
          match_type: string
          name_similarity: number | null
          needs_review: boolean
          normalized_domain: string
          review_reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          crm_company_id: string
          event_id: string
          id?: string
          id_exposant: string
          match_status?: string
          match_type?: string
          name_similarity?: number | null
          needs_review?: boolean
          normalized_domain: string
          review_reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          crm_company_id?: string
          event_id?: string
          id?: string
          id_exposant?: string
          match_status?: string
          match_type?: string
          name_similarity?: number | null
          needs_review?: boolean
          normalized_domain?: string
          review_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_company_event_matches_crm_company_id_fkey"
            columns: ["crm_company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_company_event_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "crm_company_event_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_company_event_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_company_event_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_company_event_matches_id_exposant_fkey"
            columns: ["id_exposant"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["id_exposant"]
          },
          {
            foreignKeyName: "crm_company_event_matches_id_exposant_fkey"
            columns: ["id_exposant"]
            isOneToOne: false
            referencedRelation: "exposants"
            referencedColumns: ["id_exposant"]
          },
        ]
      }
      crm_connections: {
        Row: {
          access_token_enc: string
          claim_token: string | null
          claim_token_expires_at: string | null
          created_at: string
          email_from_crm: string | null
          expires_at: string
          id: string
          portal_id: number | null
          provider: string
          provider_user_id: string | null
          refresh_token_enc: string | null
          scope: string | null
          status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token_enc: string
          claim_token?: string | null
          claim_token_expires_at?: string | null
          created_at?: string
          email_from_crm?: string | null
          expires_at: string
          id?: string
          portal_id?: number | null
          provider: string
          provider_user_id?: string | null
          refresh_token_enc?: string | null
          scope?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token_enc?: string
          claim_token?: string | null
          claim_token_expires_at?: string | null
          created_at?: string
          email_from_crm?: string | null
          expires_at?: string
          id?: string
          portal_id?: number | null
          provider?: string
          provider_user_id?: string | null
          refresh_token_enc?: string | null
          scope?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      crm_event_alerts: {
        Row: {
          alert_status: string
          alert_type: string
          created_at: string | null
          crm_company_id: string
          event_id: string
          id: string
          id_exposant: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          alert_status?: string
          alert_type?: string
          created_at?: string | null
          crm_company_id: string
          event_id: string
          id?: string
          id_exposant: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          alert_status?: string
          alert_type?: string
          created_at?: string | null
          crm_company_id?: string
          event_id?: string
          id?: string
          id_exposant?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_event_alerts_crm_company_id_fkey"
            columns: ["crm_company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_event_alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "crm_event_alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_event_alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_event_alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_event_alerts_id_exposant_fkey"
            columns: ["id_exposant"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["id_exposant"]
          },
          {
            foreignKeyName: "crm_event_alerts_id_exposant_fkey"
            columns: ["id_exposant"]
            isOneToOne: false
            referencedRelation: "exposants"
            referencedColumns: ["id_exposant"]
          },
        ]
      }
      crm_imports: {
        Row: {
          created_at: string | null
          error_message: string | null
          file_name: string | null
          id: string
          matched_companies_count: number | null
          source_type: string
          status: string
          suspicious_rate: number | null
          total_rows: number | null
          unmatched_companies_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          file_name?: string | null
          id?: string
          matched_companies_count?: number | null
          source_type?: string
          status?: string
          suspicious_rate?: number | null
          total_rows?: number | null
          unmatched_companies_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          file_name?: string | null
          id?: string
          matched_companies_count?: number | null
          source_type?: string
          status?: string
          suspicious_rate?: number | null
          total_rows?: number | null
          unmatched_companies_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      crm_notification_preferences: {
        Row: {
          created_at: string
          id: string
          last_radar_email_sent_at: string | null
          max_emails_per_week: number
          preferred_alert_timing_days: number
          radar_alerts_enabled: boolean
          radar_email_disabled_at: string | null
          radar_email_enabled: boolean
          radar_email_unsubscribed_at: string | null
          trial_teasers_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_radar_email_sent_at?: string | null
          max_emails_per_week?: number
          preferred_alert_timing_days?: number
          radar_alerts_enabled?: boolean
          radar_email_disabled_at?: string | null
          radar_email_enabled?: boolean
          radar_email_unsubscribed_at?: string | null
          trial_teasers_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_radar_email_sent_at?: string | null
          max_emails_per_week?: number
          preferred_alert_timing_days?: number
          radar_alerts_enabled?: boolean
          radar_email_disabled_at?: string | null
          radar_email_enabled?: boolean
          radar_email_unsubscribed_at?: string | null
          trial_teasers_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_usage_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          user_id?: string | null
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
      email_blacklist: {
        Row: {
          created_at: string
          created_by: string | null
          email_normalized: string
          id: string
          note: string | null
          reason: string
          source: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email_normalized: string
          id?: string
          note?: string | null
          reason: string
          source?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email_normalized?: string
          id?: string
          note?: string | null
          reason?: string
          source?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          scope: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          scope?: string
          token?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          scope?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      event_duplicate_candidates: {
        Row: {
          created_at: string
          id: string
          match_level: string
          matched_id: string
          matched_id_event: string | null
          matched_kind: string
          reasons: Json
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          score: number
          source_id: string
          source_id_event: string | null
          source_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_level: string
          matched_id: string
          matched_id_event?: string | null
          matched_kind: string
          reasons?: Json
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          score: number
          source_id: string
          source_id_event?: string | null
          source_kind: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_level?: string
          matched_id?: string
          matched_id_event?: string | null
          matched_kind?: string
          reasons?: Json
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          score?: number
          source_id?: string
          source_id_event?: string | null
          source_kind?: string
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id_text"]
          },
          {
            foreignKeyName: "event_sectors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id_event"]
          },
          {
            foreignKeyName: "event_sectors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
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
          auto_validated_at: string | null
          auto_validation_report: Json | null
          auto_validation_score: number | null
          auto_validation_status: string | null
          campagne_active: boolean | null
          code_postal: string | null
          created_at: string | null
          date_debut: string | null
          date_fin: string | null
          description_enrichie: string | null
          description_event: string | null
          duplicate_check_at: string | null
          duplicate_check_reason: string | null
          duplicate_check_score: number | null
          duplicate_check_status: string
          enrichissement_date: string | null
          enrichissement_ignored: boolean
          enrichissement_niveau: string | null
          enrichissement_score: number | null
          enrichissement_statut: string | null
          faq_json: Json | null
          id: string
          id_event: string
          is_b2b: boolean
          is_test: boolean
          location: string | null
          meta_description_gen: string | null
          nom_event: string
          nom_lieu: string | null
          pays: string | null
          rubrique_seeded: boolean | null
          rue: string | null
          salon_priorite: number | null
          secteur: Json | null
          seo_generated_at: string | null
          seo_generated_from_hash: string | null
          seo_last_checked_at: string | null
          seo_source_hash: string | null
          slug: string | null
          status_event: string | null
          tarif: string | null
          type_event: string | null
          updated_at: string | null
          url_image: string | null
          url_site_officiel: string | null
          url_site_officiel_domain: string | null
          url_site_officiel_normalized: string | null
          validation_mode: string | null
          ville: string | null
          visible: boolean | null
        }
        Insert: {
          affluence?: string | null
          airtable_id?: string | null
          auto_validated_at?: string | null
          auto_validation_report?: Json | null
          auto_validation_score?: number | null
          auto_validation_status?: string | null
          campagne_active?: boolean | null
          code_postal?: string | null
          created_at?: string | null
          date_debut?: string | null
          date_fin?: string | null
          description_enrichie?: string | null
          description_event?: string | null
          duplicate_check_at?: string | null
          duplicate_check_reason?: string | null
          duplicate_check_score?: number | null
          duplicate_check_status?: string
          enrichissement_date?: string | null
          enrichissement_ignored?: boolean
          enrichissement_niveau?: string | null
          enrichissement_score?: number | null
          enrichissement_statut?: string | null
          faq_json?: Json | null
          id?: string
          id_event: string
          is_b2b?: boolean
          is_test?: boolean
          location?: string | null
          meta_description_gen?: string | null
          nom_event: string
          nom_lieu?: string | null
          pays?: string | null
          rubrique_seeded?: boolean | null
          rue?: string | null
          salon_priorite?: number | null
          secteur?: Json | null
          seo_generated_at?: string | null
          seo_generated_from_hash?: string | null
          seo_last_checked_at?: string | null
          seo_source_hash?: string | null
          slug?: string | null
          status_event?: string | null
          tarif?: string | null
          type_event?: string | null
          updated_at?: string | null
          url_image?: string | null
          url_site_officiel?: string | null
          url_site_officiel_domain?: string | null
          url_site_officiel_normalized?: string | null
          validation_mode?: string | null
          ville?: string | null
          visible?: boolean | null
        }
        Update: {
          affluence?: string | null
          airtable_id?: string | null
          auto_validated_at?: string | null
          auto_validation_report?: Json | null
          auto_validation_score?: number | null
          auto_validation_status?: string | null
          campagne_active?: boolean | null
          code_postal?: string | null
          created_at?: string | null
          date_debut?: string | null
          date_fin?: string | null
          description_enrichie?: string | null
          description_event?: string | null
          duplicate_check_at?: string | null
          duplicate_check_reason?: string | null
          duplicate_check_score?: number | null
          duplicate_check_status?: string
          enrichissement_date?: string | null
          enrichissement_ignored?: boolean
          enrichissement_niveau?: string | null
          enrichissement_score?: number | null
          enrichissement_statut?: string | null
          faq_json?: Json | null
          id?: string
          id_event?: string
          is_b2b?: boolean
          is_test?: boolean
          location?: string | null
          meta_description_gen?: string | null
          nom_event?: string
          nom_lieu?: string | null
          pays?: string | null
          rubrique_seeded?: boolean | null
          rue?: string | null
          salon_priorite?: number | null
          secteur?: Json | null
          seo_generated_at?: string | null
          seo_generated_from_hash?: string | null
          seo_last_checked_at?: string | null
          seo_source_hash?: string | null
          slug?: string | null
          status_event?: string | null
          tarif?: string | null
          type_event?: string | null
          updated_at?: string | null
          url_image?: string | null
          url_site_officiel?: string | null
          url_site_officiel_domain?: string | null
          url_site_officiel_normalized?: string | null
          validation_mode?: string | null
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
      exhibitor_admin_claims: {
        Row: {
          created_at: string
          exhibitor_id: string
          id: string
          reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exhibitor_id: string
          id?: string
          reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exhibitor_id?: string
          id?: string
          reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibitor_admin_claims_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_admin_claims_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_admin_claims_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "participations_with_exhibitors"
            referencedColumns: ["exhibitor_uuid"]
          },
        ]
      }
      exhibitor_ai: {
        Row: {
          enriched_at: string | null
          exhibitor_id: string
          id: string
          mots_cles_metier: Json | null
          produits_services: Json | null
          profils_visiteurs: Json | null
          resume_court: string | null
          secteur_principal: string | null
          source_table: string | null
          source_url: string | null
          sous_secteurs: Json | null
          type_interet: Json | null
        }
        Insert: {
          enriched_at?: string | null
          exhibitor_id: string
          id?: string
          mots_cles_metier?: Json | null
          produits_services?: Json | null
          profils_visiteurs?: Json | null
          resume_court?: string | null
          secteur_principal?: string | null
          source_table?: string | null
          source_url?: string | null
          sous_secteurs?: Json | null
          type_interet?: Json | null
        }
        Update: {
          enriched_at?: string | null
          exhibitor_id?: string
          id?: string
          mots_cles_metier?: Json | null
          produits_services?: Json | null
          profils_visiteurs?: Json | null
          resume_court?: string | null
          secteur_principal?: string | null
          source_table?: string | null
          source_url?: string | null
          sous_secteurs?: Json | null
          type_interet?: Json | null
        }
        Relationships: []
      }
      exhibitor_ai_remap_archive: {
        Row: {
          archive_id: string
          archived_at: string
          new_exhibitor_id: string | null
          old_exhibitor_id: string
          operation: string
          original_ai_id: string
          original_row: Json
          reason: string | null
        }
        Insert: {
          archive_id?: string
          archived_at?: string
          new_exhibitor_id?: string | null
          old_exhibitor_id: string
          operation: string
          original_ai_id: string
          original_row: Json
          reason?: string | null
        }
        Update: {
          archive_id?: string
          archived_at?: string
          new_exhibitor_id?: string | null
          old_exhibitor_id?: string
          operation?: string
          original_ai_id?: string
          original_row?: Json
          reason?: string | null
        }
        Relationships: []
      }
      exhibitor_alerts: {
        Row: {
          created_at: string
          display_name_snapshot: string | null
          id: string
          last_notified_at: string | null
          public_identity_id: string | null
          public_slug: string
          source_surface: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name_snapshot?: string | null
          id?: string
          last_notified_at?: string | null
          public_identity_id?: string | null
          public_slug: string
          source_surface?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name_snapshot?: string | null
          id?: string
          last_notified_at?: string | null
          public_identity_id?: string | null
          public_slug?: string
          source_surface?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibitor_alerts_public_identity_id_fkey"
            columns: ["public_identity_id"]
            isOneToOne: false
            referencedRelation: "exhibitor_public_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_alerts_public_identity_id_fkey"
            columns: ["public_identity_id"]
            isOneToOne: false
            referencedRelation: "public_exhibitor_profiles"
            referencedColumns: ["public_identity_id"]
          },
        ]
      }
      exhibitor_claim_requests: {
        Row: {
          created_at: string | null
          exhibitor_id: string
          id: string
          requester_user_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          exhibitor_id: string
          id?: string
          requester_user_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          exhibitor_id?: string
          id?: string
          requester_user_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exhibitor_claim_requests_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_claim_requests_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_claim_requests_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "participations_with_exhibitors"
            referencedColumns: ["exhibitor_uuid"]
          },
        ]
      }
      exhibitor_create_requests: {
        Row: {
          created_at: string | null
          id: string
          proposed_name: string
          requester_user_id: string
          status: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          proposed_name: string
          requester_user_id: string
          status?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          proposed_name?: string
          requester_user_id?: string
          status?: string | null
          website?: string | null
        }
        Relationships: []
      }
      exhibitor_duplicate_domain_blacklist: {
        Row: {
          created_at: string
          created_by: string | null
          domain: string
          id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain: string
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain?: string
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      exhibitor_duplicate_reviews: {
        Row: {
          confidence: string | null
          created_at: string
          id: string
          identity_a_id: string
          identity_b_id: string
          reasons: Json
          reviewed_at: string | null
          reviewed_by: string | null
          score: number | null
          status: string
          updated_at: string
        }
        Insert: {
          confidence?: string | null
          created_at?: string
          id?: string
          identity_a_id: string
          identity_b_id: string
          reasons?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          confidence?: string | null
          created_at?: string
          id?: string
          identity_a_id?: string
          identity_b_id?: string
          reasons?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibitor_duplicate_reviews_identity_a_id_fkey"
            columns: ["identity_a_id"]
            isOneToOne: false
            referencedRelation: "exhibitor_public_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_duplicate_reviews_identity_a_id_fkey"
            columns: ["identity_a_id"]
            isOneToOne: false
            referencedRelation: "public_exhibitor_profiles"
            referencedColumns: ["public_identity_id"]
          },
          {
            foreignKeyName: "exhibitor_duplicate_reviews_identity_b_id_fkey"
            columns: ["identity_b_id"]
            isOneToOne: false
            referencedRelation: "exhibitor_public_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_duplicate_reviews_identity_b_id_fkey"
            columns: ["identity_b_id"]
            isOneToOne: false
            referencedRelation: "public_exhibitor_profiles"
            referencedColumns: ["public_identity_id"]
          },
        ]
      }
      exhibitor_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          public_identity_id: string | null
          public_slug: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          public_identity_id?: string | null
          public_slug: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          public_identity_id?: string | null
          public_slug?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exhibitor_events_public_identity_id_fkey"
            columns: ["public_identity_id"]
            isOneToOne: false
            referencedRelation: "exhibitor_public_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_events_public_identity_id_fkey"
            columns: ["public_identity_id"]
            isOneToOne: false
            referencedRelation: "public_exhibitor_profiles"
            referencedColumns: ["public_identity_id"]
          },
        ]
      }
      exhibitor_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          exhibitor_id: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          exhibitor_id: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          exhibitor_id?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibitor_invitations_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_invitations_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_invitations_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "participations_with_exhibitors"
            referencedColumns: ["exhibitor_uuid"]
          },
        ]
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
      exhibitor_profile_change_logs: {
        Row: {
          actor_role: string
          actor_user_id: string
          changed_fields: string[]
          changes: Json
          created_at: string
          exhibitor_id: string
          id: string
          source: string
        }
        Insert: {
          actor_role: string
          actor_user_id: string
          changed_fields: string[]
          changes: Json
          created_at?: string
          exhibitor_id: string
          id?: string
          source?: string
        }
        Update: {
          actor_role?: string
          actor_user_id?: string
          changed_fields?: string[]
          changes?: Json
          created_at?: string
          exhibitor_id?: string
          id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibitor_profile_change_logs_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_profile_change_logs_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_profile_change_logs_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "participations_with_exhibitors"
            referencedColumns: ["exhibitor_uuid"]
          },
        ]
      }
      exhibitor_public_identities: {
        Row: {
          canonical_name: string
          created_at: string
          exhibitor_id: string | null
          id: string
          is_active: boolean
          legacy_exposant_id: string | null
          public_slug: string
          source_type: string
          updated_at: string
        }
        Insert: {
          canonical_name: string
          created_at?: string
          exhibitor_id?: string | null
          id?: string
          is_active?: boolean
          legacy_exposant_id?: string | null
          public_slug: string
          source_type: string
          updated_at?: string
        }
        Update: {
          canonical_name?: string
          created_at?: string
          exhibitor_id?: string | null
          id?: string
          is_active?: boolean
          legacy_exposant_id?: string | null
          public_slug?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibitor_public_identities_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_public_identities_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_public_identities_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "participations_with_exhibitors"
            referencedColumns: ["exhibitor_uuid"]
          },
        ]
      }
      exhibitor_team_members: {
        Row: {
          created_at: string
          exhibitor_id: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["exhibitor_team_role"]
          status: Database["public"]["Enums"]["exhibitor_team_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exhibitor_id: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["exhibitor_team_role"]
          status?: Database["public"]["Enums"]["exhibitor_team_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exhibitor_id?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["exhibitor_team_role"]
          status?: Database["public"]["Enums"]["exhibitor_team_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibitor_team_members_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_team_members_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_team_members_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "participations_with_exhibitors"
            referencedColumns: ["exhibitor_uuid"]
          },
        ]
      }
      exhibitors: {
        Row: {
          approved: boolean | null
          campaign_eligible: boolean | null
          campaign_status: string | null
          campaign_stop_reason: string | null
          company_size_signal: string | null
          company_tier: string | null
          contact_email: string | null
          contact_poste: string | null
          contact_prenom: string | null
          contact_score: number | null
          created_at: string | null
          current_step: number | null
          description: string | null
          email_source: string | null
          hunter_search_done: boolean | null
          hunter_verify_done: boolean | null
          id: string
          is_generic_inbox: boolean | null
          is_test: boolean
          last_sent_at: string | null
          linkedin_url: string | null
          logo_url: string | null
          name: string
          name_normalized: string | null
          next_send_date: string | null
          opt_out: boolean | null
          outlook_conv_id: string | null
          outlook_message_id: string | null
          owner_user_id: string | null
          plan: string | null
          pre_hunter_score: number | null
          reply_date: string | null
          reply_status: string | null
          slug: string | null
          stand_info: string | null
          updated_at: string | null
          verified_at: string | null
          website: string | null
        }
        Insert: {
          approved?: boolean | null
          campaign_eligible?: boolean | null
          campaign_status?: string | null
          campaign_stop_reason?: string | null
          company_size_signal?: string | null
          company_tier?: string | null
          contact_email?: string | null
          contact_poste?: string | null
          contact_prenom?: string | null
          contact_score?: number | null
          created_at?: string | null
          current_step?: number | null
          description?: string | null
          email_source?: string | null
          hunter_search_done?: boolean | null
          hunter_verify_done?: boolean | null
          id?: string
          is_generic_inbox?: boolean | null
          is_test?: boolean
          last_sent_at?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          name: string
          name_normalized?: string | null
          next_send_date?: string | null
          opt_out?: boolean | null
          outlook_conv_id?: string | null
          outlook_message_id?: string | null
          owner_user_id?: string | null
          plan?: string | null
          pre_hunter_score?: number | null
          reply_date?: string | null
          reply_status?: string | null
          slug?: string | null
          stand_info?: string | null
          updated_at?: string | null
          verified_at?: string | null
          website?: string | null
        }
        Update: {
          approved?: boolean | null
          campaign_eligible?: boolean | null
          campaign_status?: string | null
          campaign_stop_reason?: string | null
          company_size_signal?: string | null
          company_tier?: string | null
          contact_email?: string | null
          contact_poste?: string | null
          contact_prenom?: string | null
          contact_score?: number | null
          created_at?: string | null
          current_step?: number | null
          description?: string | null
          email_source?: string | null
          hunter_search_done?: boolean | null
          hunter_verify_done?: boolean | null
          id?: string
          is_generic_inbox?: boolean | null
          is_test?: boolean
          last_sent_at?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          name?: string
          name_normalized?: string | null
          next_send_date?: string | null
          opt_out?: boolean | null
          outlook_conv_id?: string | null
          outlook_message_id?: string | null
          owner_user_id?: string | null
          plan?: string | null
          pre_hunter_score?: number | null
          reply_date?: string | null
          reply_status?: string | null
          slug?: string | null
          stand_info?: string | null
          updated_at?: string | null
          verified_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      exposants: {
        Row: {
          created_at: string | null
          exposant_description: string | null
          id: number
          id_exposant: string | null
          nom_exposant: string | null
          nom_normalized: string | null
          normalized_domain: string | null
          website_exposant: string | null
        }
        Insert: {
          created_at?: string | null
          exposant_description?: string | null
          id?: number
          id_exposant?: string | null
          nom_exposant?: string | null
          nom_normalized?: string | null
          normalized_domain?: string | null
          website_exposant?: string | null
        }
        Update: {
          created_at?: string | null
          exposant_description?: string | null
          id?: number
          id_exposant?: string | null
          nom_exposant?: string | null
          nom_normalized?: string | null
          normalized_domain?: string | null
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
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
          },
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
            foreignKeyName: "favorites_event_fkey"
            columns: ["event_uuid"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
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
          {
            foreignKeyName: "favorites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
          },
        ]
      }
      import_errors: {
        Row: {
          airtable_record_id: string
          context_data: Json | null
          created_at: string | null
          entity_type: string
          error_category: string
          error_reason: string
          id: string
          import_session_id: string
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          airtable_record_id: string
          context_data?: Json | null
          created_at?: string | null
          entity_type: string
          error_category: string
          error_reason: string
          id?: string
          import_session_id: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          airtable_record_id?: string
          context_data?: Json | null
          created_at?: string | null
          entity_type?: string
          error_category?: string
          error_reason?: string
          id?: string
          import_session_id?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: []
      }
      import_sessions: {
        Row: {
          completed_at: string | null
          created_by: string | null
          events_errors: number | null
          events_imported: number | null
          exposants_errors: number | null
          exposants_imported: number | null
          id: string
          participations_errors: number | null
          participations_imported: number | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_by?: string | null
          events_errors?: number | null
          events_imported?: number | null
          exposants_errors?: number | null
          exposants_imported?: number | null
          id?: string
          participations_errors?: number | null
          participations_imported?: number | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_by?: string | null
          events_errors?: number | null
          events_imported?: number | null
          exposants_errors?: number | null
          exposants_imported?: number | null
          id?: string
          participations_errors?: number | null
          participations_imported?: number | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          company: string | null
          created_at: string
          email: string
          event_id: string | null
          exhibitor_id: string | null
          first_name: string
          id: string
          last_name: string
          lead_company: string | null
          lead_email: string | null
          lead_name: string | null
          lead_phone: string | null
          lead_position: string | null
          lead_type: string
          message: string | null
          notes: string | null
          novelty_id: string
          phone: string | null
          rdv_date: string | null
          role: string | null
          stand_info: string | null
          status: string | null
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          event_id?: string | null
          exhibitor_id?: string | null
          first_name: string
          id?: string
          last_name: string
          lead_company?: string | null
          lead_email?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          lead_position?: string | null
          lead_type: string
          message?: string | null
          notes?: string | null
          novelty_id: string
          phone?: string | null
          rdv_date?: string | null
          role?: string | null
          stand_info?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          event_id?: string | null
          exhibitor_id?: string | null
          first_name?: string
          id?: string
          last_name?: string
          lead_company?: string | null
          lead_email?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          lead_position?: string | null
          lead_type?: string
          message?: string | null
          notes?: string | null
          novelty_id?: string
          phone?: string | null
          rdv_date?: string | null
          role?: string | null
          stand_info?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "leads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "participations_with_exhibitors"
            referencedColumns: ["exhibitor_uuid"]
          },
          {
            foreignKeyName: "leads_novelty_id_fkey"
            columns: ["novelty_id"]
            isOneToOne: false
            referencedRelation: "novelties"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscriptions: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: unknown
          sector_id: string | null
          sectors: string[] | null
          subscription_count: number | null
          verified: boolean | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: unknown
          sector_id?: string | null
          sectors?: string[] | null
          subscription_count?: number | null
          verified?: boolean | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: unknown
          sector_id?: string | null
          sectors?: string[] | null
          subscription_count?: number | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_subscriptions_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_avatar_url: string | null
          actor_company: string | null
          actor_email: string | null
          actor_name: string | null
          actor_user_id: string | null
          category: string
          comment_id: string | null
          created_at: string | null
          event_id: string | null
          exhibitor_id: string | null
          group_count: number | null
          group_key: string | null
          icon: string | null
          id: string
          lead_id: string | null
          link_url: string | null
          message: string
          metadata: Json | null
          novelty_id: string | null
          read: boolean | null
          read_at: string | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actor_avatar_url?: string | null
          actor_company?: string | null
          actor_email?: string | null
          actor_name?: string | null
          actor_user_id?: string | null
          category: string
          comment_id?: string | null
          created_at?: string | null
          event_id?: string | null
          exhibitor_id?: string | null
          group_count?: number | null
          group_key?: string | null
          icon?: string | null
          id?: string
          lead_id?: string | null
          link_url?: string | null
          message: string
          metadata?: Json | null
          novelty_id?: string | null
          read?: boolean | null
          read_at?: string | null
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actor_avatar_url?: string | null
          actor_company?: string | null
          actor_email?: string | null
          actor_name?: string | null
          actor_user_id?: string | null
          category?: string
          comment_id?: string | null
          created_at?: string | null
          event_id?: string | null
          exhibitor_id?: string | null
          group_count?: number | null
          group_key?: string | null
          icon?: string | null
          id?: string
          lead_id?: string | null
          link_url?: string | null
          message?: string
          metadata?: Json | null
          novelty_id?: string | null
          read?: boolean | null
          read_at?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "participations_with_exhibitors"
            referencedColumns: ["exhibitor_uuid"]
          },
          {
            foreignKeyName: "notifications_novelty_id_fkey"
            columns: ["novelty_id"]
            isOneToOne: false
            referencedRelation: "novelties"
            referencedColumns: ["id"]
          },
        ]
      }
      novelties: {
        Row: {
          audience_tags: string[] | null
          availability: string | null
          created_at: string | null
          created_by: string | null
          demo_slots: Json | null
          details: string | null
          doc_url: string | null
          event_id: string
          exhibitor_id: string
          id: string
          images_count: number | null
          is_premium: boolean | null
          is_test: boolean
          media_urls: string[] | null
          pending_exhibitor_id: string | null
          reason_1: string | null
          reason_2: string | null
          reason_3: string | null
          resource_url: string | null
          stand_info: string | null
          status: string | null
          summary: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          audience_tags?: string[] | null
          availability?: string | null
          created_at?: string | null
          created_by?: string | null
          demo_slots?: Json | null
          details?: string | null
          doc_url?: string | null
          event_id: string
          exhibitor_id: string
          id?: string
          images_count?: number | null
          is_premium?: boolean | null
          is_test?: boolean
          media_urls?: string[] | null
          pending_exhibitor_id?: string | null
          reason_1?: string | null
          reason_2?: string | null
          reason_3?: string | null
          resource_url?: string | null
          stand_info?: string | null
          status?: string | null
          summary?: string | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          audience_tags?: string[] | null
          availability?: string | null
          created_at?: string | null
          created_by?: string | null
          demo_slots?: Json | null
          details?: string | null
          doc_url?: string | null
          event_id?: string
          exhibitor_id?: string
          id?: string
          images_count?: number | null
          is_premium?: boolean | null
          is_test?: boolean
          media_urls?: string[] | null
          pending_exhibitor_id?: string | null
          reason_1?: string | null
          reason_2?: string | null
          reason_3?: string | null
          resource_url?: string | null
          stand_info?: string | null
          status?: string | null
          summary?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "novelties_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "novelties_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "novelties_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "novelties_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "novelties_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "novelties_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "novelties_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "participations_with_exhibitors"
            referencedColumns: ["exhibitor_uuid"]
          },
          {
            foreignKeyName: "novelties_pending_exhibitor_id_fkey"
            columns: ["pending_exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "novelties_pending_exhibitor_id_fkey"
            columns: ["pending_exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "novelties_pending_exhibitor_id_fkey"
            columns: ["pending_exhibitor_id"]
            isOneToOne: false
            referencedRelation: "participations_with_exhibitors"
            referencedColumns: ["exhibitor_uuid"]
          },
        ]
      }
      novelty_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          novelty_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          novelty_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          novelty_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "novelty_comments_novelty_id_fkey"
            columns: ["novelty_id"]
            isOneToOne: false
            referencedRelation: "novelties"
            referencedColumns: ["id"]
          },
        ]
      }
      novelty_images: {
        Row: {
          created_at: string
          id: string
          novelty_id: string
          position: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          novelty_id: string
          position: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          novelty_id?: string
          position?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "novelty_images_novelty_id_fkey"
            columns: ["novelty_id"]
            isOneToOne: false
            referencedRelation: "novelties"
            referencedColumns: ["id"]
          },
        ]
      }
      novelty_likes: {
        Row: {
          created_at: string | null
          id: string
          novelty_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          novelty_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          novelty_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "novelty_likes_novelty_id_fkey"
            columns: ["novelty_id"]
            isOneToOne: false
            referencedRelation: "novelties"
            referencedColumns: ["id"]
          },
        ]
      }
      novelty_stats: {
        Row: {
          novelty_id: string
          popularity_score: number | null
          reminders_count: number | null
          route_users_count: number | null
          saves_count: number | null
          updated_at: string | null
        }
        Insert: {
          novelty_id: string
          popularity_score?: number | null
          reminders_count?: number | null
          route_users_count?: number | null
          saves_count?: number | null
          updated_at?: string | null
        }
        Update: {
          novelty_id?: string
          popularity_score?: number | null
          reminders_count?: number | null
          route_users_count?: number | null
          saves_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "novelty_stats_novelty_id_fkey"
            columns: ["novelty_id"]
            isOneToOne: true
            referencedRelation: "novelties"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_campaigns: {
        Row: {
          campaign_status: string | null
          claude_classification: string | null
          company_name: string | null
          company_name_normalized: string | null
          contact_email: string | null
          created_at: string | null
          current_step: number | null
          email_source: string | null
          event_id: string
          exhibitor_id: string | null
          hunter_poste: string | null
          hunter_prenom: string | null
          hunter_score: number | null
          hunter_status: string | null
          id: string
          id_exposant_legacy: string | null
          last_sent_at: string | null
          next_send_at: string | null
          novelty_id: string | null
          opt_out: boolean | null
          participation_id: string | null
          reply_status: string | null
          stop_note: string | null
          stop_reason: string | null
          stopped_at: string | null
          stopped_by: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          campaign_status?: string | null
          claude_classification?: string | null
          company_name?: string | null
          company_name_normalized?: string | null
          contact_email?: string | null
          created_at?: string | null
          current_step?: number | null
          email_source?: string | null
          event_id: string
          exhibitor_id?: string | null
          hunter_poste?: string | null
          hunter_prenom?: string | null
          hunter_score?: number | null
          hunter_status?: string | null
          id?: string
          id_exposant_legacy?: string | null
          last_sent_at?: string | null
          next_send_at?: string | null
          novelty_id?: string | null
          opt_out?: boolean | null
          participation_id?: string | null
          reply_status?: string | null
          stop_note?: string | null
          stop_reason?: string | null
          stopped_at?: string | null
          stopped_by?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          campaign_status?: string | null
          claude_classification?: string | null
          company_name?: string | null
          company_name_normalized?: string | null
          contact_email?: string | null
          created_at?: string | null
          current_step?: number | null
          email_source?: string | null
          event_id?: string
          exhibitor_id?: string | null
          hunter_poste?: string | null
          hunter_prenom?: string | null
          hunter_score?: number | null
          hunter_status?: string | null
          id?: string
          id_exposant_legacy?: string | null
          last_sent_at?: string | null
          next_send_at?: string | null
          novelty_id?: string | null
          opt_out?: boolean | null
          participation_id?: string | null
          reply_status?: string | null
          stop_note?: string | null
          stop_reason?: string | null
          stopped_at?: string | null
          stopped_by?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "outreach_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "participations_with_exhibitors"
            referencedColumns: ["exhibitor_uuid"]
          },
          {
            foreignKeyName: "outreach_campaigns_novelty_id_fkey"
            columns: ["novelty_id"]
            isOneToOne: false
            referencedRelation: "novelties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: true
            referencedRelation: "participation"
            referencedColumns: ["id_participation"]
          },
          {
            foreignKeyName: "outreach_campaigns_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: true
            referencedRelation: "participations_with_exhibitors"
            referencedColumns: ["id_participation"]
          },
          {
            foreignKeyName: "outreach_campaigns_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: true
            referencedRelation: "v_outreach_campaigns_missing"
            referencedColumns: ["id_participation"]
          },
        ]
      }
      outreach_contacts: {
        Row: {
          contact_email: string
          contact_status: string
          created_at: string
          department_guess: string | null
          email_sent_count: number
          first_name: string | null
          full_name: string | null
          hunter_confidence: number | null
          hunter_score: number
          id: string
          is_primary: boolean
          job_title: string | null
          last_name: string | null
          last_reply_at: string | null
          last_sent_at: string | null
          outreach_campaign_id: string
          source: string
          updated_at: string
        }
        Insert: {
          contact_email: string
          contact_status?: string
          created_at?: string
          department_guess?: string | null
          email_sent_count?: number
          first_name?: string | null
          full_name?: string | null
          hunter_confidence?: number | null
          hunter_score?: number
          id?: string
          is_primary?: boolean
          job_title?: string | null
          last_name?: string | null
          last_reply_at?: string | null
          last_sent_at?: string | null
          outreach_campaign_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_status?: string
          created_at?: string
          department_guess?: string | null
          email_sent_count?: number
          first_name?: string | null
          full_name?: string | null
          hunter_confidence?: number | null
          hunter_score?: number
          id?: string
          is_primary?: boolean
          job_title?: string | null
          last_name?: string | null
          last_reply_at?: string | null
          last_sent_at?: string | null
          outreach_campaign_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_contacts_outreach_campaign_id_fkey"
            columns: ["outreach_campaign_id"]
            isOneToOne: false
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_contacts_outreach_campaign_id_fkey"
            columns: ["outreach_campaign_id"]
            isOneToOne: false
            referencedRelation: "v_a_enrichir"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_contacts_outreach_campaign_id_fkey"
            columns: ["outreach_campaign_id"]
            isOneToOne: false
            referencedRelation: "v_a_enrichir_test"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_contacts_outreach_campaign_id_fkey"
            columns: ["outreach_campaign_id"]
            isOneToOne: false
            referencedRelation: "v_exposants_eligibles"
            referencedColumns: ["id"]
          },
        ]
      }
      participation: {
        Row: {
          created_at: string | null
          exhibitor_id: string | null
          id_event: string | null
          id_event_text: string | null
          id_exposant: string
          id_participation: string
          stand_exposant: string | null
          urlexpo_event: string | null
          website_exposant: string | null
        }
        Insert: {
          created_at?: string | null
          exhibitor_id?: string | null
          id_event?: string | null
          id_event_text?: string | null
          id_exposant: string
          id_participation?: string
          stand_exposant?: string | null
          urlexpo_event?: string | null
          website_exposant?: string | null
        }
        Update: {
          created_at?: string | null
          exhibitor_id?: string | null
          id_event?: string | null
          id_event_text?: string | null
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
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
          },
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
            foreignKeyName: "fk_participation_event"
            columns: ["id_event"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
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
      plans: {
        Row: {
          created_at: string
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      premium_entitlements: {
        Row: {
          csv_export: boolean
          event_id: string
          exhibitor_id: string
          granted_at: string
          granted_by: string
          id: string
          leads_unlimited: boolean
          max_novelties: number
          notes: string | null
          revoked_at: string | null
        }
        Insert: {
          csv_export?: boolean
          event_id: string
          exhibitor_id: string
          granted_at?: string
          granted_by: string
          id?: string
          leads_unlimited?: boolean
          max_novelties?: number
          notes?: string | null
          revoked_at?: string | null
        }
        Update: {
          csv_export?: boolean
          event_id?: string
          exhibitor_id?: string
          granted_at?: string
          granted_by?: string
          id?: string
          leads_unlimited?: boolean
          max_novelties?: number
          notes?: string | null
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "premium_entitlements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "premium_entitlements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_entitlements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_entitlements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_entitlements_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_entitlements_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_entitlements_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "participations_with_exhibitors"
            referencedColumns: ["exhibitor_uuid"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
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
          avatar_url?: string | null
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
          avatar_url?: string | null
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
      radar_email_log: {
        Row: {
          companies_count: number
          created_at: string
          dry_run: boolean
          email_subject: string | null
          email_to: string | null
          email_type: string
          error_message: string | null
          event_ids: string[]
          events_count: number
          id: string
          import_ids: string[]
          metadata: Json
          notification_ids: string[]
          resend_message_id: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
          visibility_mode: string
        }
        Insert: {
          companies_count?: number
          created_at?: string
          dry_run?: boolean
          email_subject?: string | null
          email_to?: string | null
          email_type?: string
          error_message?: string | null
          event_ids?: string[]
          events_count?: number
          id?: string
          import_ids?: string[]
          metadata?: Json
          notification_ids?: string[]
          resend_message_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          visibility_mode?: string
        }
        Update: {
          companies_count?: number
          created_at?: string
          dry_run?: boolean
          email_subject?: string | null
          email_to?: string | null
          email_type?: string
          error_message?: string | null
          event_ids?: string[]
          events_count?: number
          id?: string
          import_ids?: string[]
          metadata?: Json
          notification_ids?: string[]
          resend_message_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          visibility_mode?: string
        }
        Relationships: []
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
      route_items: {
        Row: {
          created_at: string | null
          id: string
          novelty_id: string
          route_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          novelty_id: string
          route_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          novelty_id?: string
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_items_novelty_id_fkey"
            columns: ["novelty_id"]
            isOneToOne: false
            referencedRelation: "novelties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_items_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "user_routes"
            referencedColumns: ["id"]
          },
        ]
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
      security_events: {
        Row: {
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: unknown
          severity: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      seo_checklist: {
        Row: {
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          created_at: string
          id: string
          item_key: string
          label: string
        }
        Insert: {
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          item_key: string
          label: string
        }
        Update: {
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          item_key?: string
          label?: string
        }
        Relationships: []
      }
      seo_enrichment_runs: {
        Row: {
          created_at: string
          deploy_hook_error: string | null
          deploy_hook_status: number | null
          deploy_hook_triggered: boolean
          description_done: number
          details: Json
          error_message: string | null
          events_failed: number
          events_processed: number
          events_selected: number
          events_skipped: number
          events_success: number
          finished_at: string | null
          id: string
          meta_done: number
          started_at: string
          status: string
          trigger_source: string
        }
        Insert: {
          created_at?: string
          deploy_hook_error?: string | null
          deploy_hook_status?: number | null
          deploy_hook_triggered?: boolean
          description_done?: number
          details?: Json
          error_message?: string | null
          events_failed?: number
          events_processed?: number
          events_selected?: number
          events_skipped?: number
          events_success?: number
          finished_at?: string | null
          id?: string
          meta_done?: number
          started_at?: string
          status?: string
          trigger_source?: string
        }
        Update: {
          created_at?: string
          deploy_hook_error?: string | null
          deploy_hook_status?: number | null
          deploy_hook_triggered?: boolean
          description_done?: number
          details?: Json
          error_message?: string | null
          events_failed?: number
          events_processed?: number
          events_selected?: number
          events_skipped?: number
          events_success?: number
          finished_at?: string | null
          id?: string
          meta_done?: number
          started_at?: string
          status?: string
          trigger_source?: string
        }
        Relationships: []
      }
      seo_keywords: {
        Row: {
          created_at: string
          current_position: number | null
          id: string
          keyword: string
          notes: string | null
          previous_position: number | null
          serp_features: string | null
          target_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_position?: number | null
          id?: string
          keyword: string
          notes?: string | null
          previous_position?: number | null
          serp_features?: string | null
          target_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_position?: number | null
          id?: string
          keyword?: string
          notes?: string | null
          previous_position?: number | null
          serp_features?: string | null
          target_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seo_quick_wins: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string
          effort: string
          id: string
          impact: string
          status: string
          title: string
        }
        Insert: {
          category?: string
          completed_at?: string | null
          created_at?: string
          effort?: string
          id?: string
          impact?: string
          status?: string
          title: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string
          effort?: string
          id?: string
          impact?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      seo_scans: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          phase: string | null
          results: Json
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          phase?: string | null
          results?: Json
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          phase?: string | null
          results?: Json
          status?: string
        }
        Relationships: []
      }
      slug_redirects: {
        Row: {
          created_at: string | null
          new_slug: string
          old_slug: string
        }
        Insert: {
          created_at?: string | null
          new_slug: string
          old_slug: string
        }
        Update: {
          created_at?: string | null
          new_slug?: string
          old_slug?: string
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
          duplicate_check_at: string | null
          duplicate_check_reason: string | null
          duplicate_check_score: number | null
          duplicate_check_status: string | null
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
          duplicate_check_at?: string | null
          duplicate_check_reason?: string | null
          duplicate_check_score?: number | null
          duplicate_check_status?: string | null
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
          duplicate_check_at?: string | null
          duplicate_check_reason?: string | null
          duplicate_check_score?: number | null
          duplicate_check_status?: string | null
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
      system_locks: {
        Row: {
          lock_name: string
          locked_at: string
          reason: string | null
        }
        Insert: {
          lock_name: string
          locked_at?: string
          reason?: string | null
        }
        Update: {
          lock_name?: string
          locked_at?: string
          reason?: string | null
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
      user_radar_access: {
        Row: {
          access_status: string
          created_at: string
          first_qualified_import_at: string | null
          first_qualified_import_id: string | null
          id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscribed_at: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_status?: string
          created_at?: string
          first_qualified_import_at?: string | null
          first_qualified_import_id?: string | null
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscribed_at?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_status?: string
          created_at?: string
          first_qualified_import_at?: string | null
          first_qualified_import_id?: string | null
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscribed_at?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_radar_access_first_qualified_import_id_fkey"
            columns: ["first_qualified_import_id"]
            isOneToOne: false
            referencedRelation: "crm_imports"
            referencedColumns: ["id"]
          },
        ]
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
      user_routes: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_routes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "user_routes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_routes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_routes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_plans: {
        Row: {
          created_at: string | null
          duration: string | null
          event_id: string
          id: string
          keywords: string[] | null
          objectif: string | null
          optionnels: Json | null
          prioritaires: Json | null
          role: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration?: string | null
          event_id: string
          id?: string
          keywords?: string[] | null
          objectif?: string | null
          optionnels?: Json | null
          prioritaires?: Json | null
          role?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration?: string | null
          event_id?: string
          id?: string
          keywords?: string[] | null
          objectif?: string | null
          optionnels?: Json | null
          prioritaires?: Json | null
          role?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_plans_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "visit_plans_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_plans_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_plans_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
          },
        ]
      }
      wizard_sessions: {
        Row: {
          ai_duration_ms: number | null
          ai_error: string | null
          auth_method: string | null
          auth_shown: boolean | null
          auth_success: boolean | null
          completed_at: string | null
          created_at: string | null
          duration: string | null
          event_id: string | null
          id: string
          keywords: string[] | null
          nb_optionnels: number | null
          nb_prioritaires: number | null
          objectif: string | null
          role: string | null
          saved: boolean | null
          step_reached: string
          user_id: string | null
        }
        Insert: {
          ai_duration_ms?: number | null
          ai_error?: string | null
          auth_method?: string | null
          auth_shown?: boolean | null
          auth_success?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          duration?: string | null
          event_id?: string | null
          id?: string
          keywords?: string[] | null
          nb_optionnels?: number | null
          nb_prioritaires?: number | null
          objectif?: string | null
          role?: string | null
          saved?: boolean | null
          step_reached?: string
          user_id?: string | null
        }
        Update: {
          ai_duration_ms?: number | null
          ai_error?: string | null
          auth_method?: string | null
          auth_shown?: boolean | null
          auth_success?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          duration?: string | null
          event_id?: string | null
          id?: string
          keywords?: string[] | null
          nb_optionnels?: number | null
          nb_prioritaires?: number | null
          objectif?: string | null
          role?: string | null
          saved?: boolean | null
          step_reached?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wizard_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "wizard_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wizard_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wizard_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      crm_radar_participations_view: {
        Row: {
          date_debut: string | null
          date_fin: string | null
          days_until_event: number | null
          description_event: string | null
          event_id: string | null
          event_id_text: string | null
          id_exposant: string | null
          is_future_event: boolean | null
          nom_event: string | null
          nom_exposant: string | null
          nom_lieu: string | null
          normalized_domain: string | null
          participation_row_count: number | null
          representative_participation_id: string | null
          secteur: Json | null
          slug: string | null
          stand_count: number | null
          stand_exposants_list: string | null
          type_event: string | null
          url_image: string | null
          urlexpo_event: string | null
          ville: string | null
          visible: boolean | null
          website_exposant: string | null
        }
        Relationships: []
      }
      events_geo: {
        Row: {
          affluence: string | null
          airtable_id: string | null
          code_postal: string | null
          commune_id: number | null
          created_at: string | null
          date_debut: string | null
          date_fin: string | null
          dep_code: string | null
          description_event: string | null
          id: string | null
          id_event: string | null
          is_b2b: boolean | null
          location: string | null
          nom_event: string | null
          nom_lieu: string | null
          pays: string | null
          region_code: string | null
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
      exhibitors_public: {
        Row: {
          approved: boolean | null
          created_at: string | null
          description: string | null
          id: string | null
          is_test: boolean | null
          logo_url: string | null
          name: string | null
          owner_user_id: string | null
          plan: string | null
          slug: string | null
          stand_info: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          approved?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_test?: boolean | null
          logo_url?: string | null
          name?: string | null
          owner_user_id?: string | null
          plan?: string | null
          slug?: string | null
          stand_info?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          approved?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_test?: boolean | null
          logo_url?: string | null
          name?: string | null
          owner_user_id?: string | null
          plan?: string | null
          slug?: string | null
          stand_info?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      exposants_a_enrichir: {
        Row: {
          exposant_description: string | null
          id: number | null
          nom_exposant: string | null
          website_exposant: string | null
        }
        Insert: {
          exposant_description?: string | null
          id?: number | null
          nom_exposant?: string | null
          website_exposant?: string | null
        }
        Update: {
          exposant_description?: string | null
          id?: number | null
          nom_exposant?: string | null
          website_exposant?: string | null
        }
        Relationships: []
      }
      participations_with_exhibitors: {
        Row: {
          approved: boolean | null
          description_final: string | null
          exhibitor_id: string | null
          exhibitor_name: string | null
          exhibitor_uuid: string | null
          exhibitor_website: string | null
          exposant_description: string | null
          id_event: string | null
          id_event_text: string | null
          id_exposant: string | null
          id_participation: string | null
          legacy_description: string | null
          legacy_name: string | null
          legacy_website: string | null
          logo_url: string | null
          modern_description: string | null
          name_final: string | null
          participation_website: string | null
          plan: string | null
          stand_exposant: string | null
          stand_info: string | null
          urlexpo_event: string | null
          website_exposant: string | null
          website_final: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_participation_event"
            columns: ["id_event"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
          },
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
            foreignKeyName: "fk_participation_event"
            columns: ["id_event"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
          },
        ]
      }
      public_exhibitor_profiles: {
        Row: {
          ai_summary: string | null
          canonical_name: string | null
          created_at: string | null
          description: string | null
          display_name: string | null
          exhibitor_id: string | null
          future_participations_count: number | null
          has_description: boolean | null
          has_future_events: boolean | null
          has_logo: boolean | null
          has_published_novelties: boolean | null
          has_website: boolean | null
          is_active: boolean | null
          is_claimed: boolean | null
          is_test: boolean | null
          is_verified: boolean | null
          last_activity_at: string | null
          legacy_exposant_id: string | null
          linkedin_url: string | null
          logo_url: string | null
          next_event_at: string | null
          past_participations_count: number | null
          public_identity_id: string | null
          public_slug: string | null
          published_novelties_count: number | null
          seo_indexable: boolean | null
          seo_reason: string | null
          source_type: string | null
          total_participations: number | null
          updated_at: string | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exhibitor_public_identities_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_public_identities_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitor_public_identities_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "participations_with_exhibitors"
            referencedColumns: ["exhibitor_uuid"]
          },
        ]
      }
      v_a_enrichir: {
        Row: {
          company_name: string | null
          date_debut: string | null
          days_before_event: number | null
          event_id: string | null
          event_slug: string | null
          hunter_status: string | null
          id: string | null
          nom_event: string | null
          participation_id: string | null
          ville: string | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "outreach_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: true
            referencedRelation: "participation"
            referencedColumns: ["id_participation"]
          },
          {
            foreignKeyName: "outreach_campaigns_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: true
            referencedRelation: "participations_with_exhibitors"
            referencedColumns: ["id_participation"]
          },
          {
            foreignKeyName: "outreach_campaigns_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: true
            referencedRelation: "v_outreach_campaigns_missing"
            referencedColumns: ["id_participation"]
          },
        ]
      }
      v_a_enrichir_test: {
        Row: {
          company_name: string | null
          date_debut: string | null
          days_before_event: number | null
          hunter_status: string | null
          id: string | null
          nom_event: string | null
          website: string | null
        }
        Relationships: []
      }
      v_events_outreach_eligible: {
        Row: {
          date_debut: string | null
          days_before_event: number | null
          id: string | null
          nom_event: string | null
          participations_with_website: number | null
          slug: string | null
          ville: string | null
        }
        Relationships: []
      }
      v_exposants_eligibles: {
        Row: {
          campaign_status: string | null
          claude_classification: string | null
          company_name: string | null
          contact_email: string | null
          current_step: number | null
          days_before_event: number | null
          event_id: string | null
          event_slug: string | null
          first_name: string | null
          id: string | null
          job_title: string | null
          last_name: string | null
          next_send_at: string | null
          nom_event: string | null
          novelties_count: number | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "outreach_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
          },
        ]
      }
      v_outreach_campaigns_missing: {
        Row: {
          company_name: string | null
          exhibitor_id: string | null
          id_event: string | null
          id_exposant_legacy: string | null
          id_participation: string | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_participation_event"
            columns: ["id_event"]
            isOneToOne: false
            referencedRelation: "crm_radar_participations_view"
            referencedColumns: ["event_id"]
          },
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
            foreignKeyName: "fk_participation_event"
            columns: ["id_event"]
            isOneToOne: false
            referencedRelation: "v_events_outreach_eligible"
            referencedColumns: ["id"]
          },
        ]
      }
      v_seo_enrichment_status: {
        Row: {
          failed_last_7d: number | null
          last_run: Json | null
          runs_last_7d: number | null
          success_last_7d: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _exhibitor_ai_completeness: {
        Args: { a: Database["public"]["Tables"]["exhibitor_ai"]["Row"] }
        Returns: number
      }
      _exhibitor_identity_dep_profile: {
        Args: { p_identity_id: string }
        Returns: Json
      }
      _is_uuid_text: { Args: { p_val: string }; Returns: boolean }
      _recon_classify_group: { Args: { p_profiles: Json }; Returns: Json }
      _recon_classify_pair: {
        Args: {
          p_a: string
          p_a_src: string
          p_b: string
          p_b_src: string
          p_reasons: Json
        }
        Returns: Json
      }
      _recon_norm_domain: { Args: { p_val: string }; Returns: string }
      admin_find_website_duplicate: {
        Args: {
          p_domain: string
          p_exclude_exhibitor?: string
          p_exclude_legacy?: string
        }
        Returns: Json
      }
      admin_hard_delete_exhibitor: {
        Args: {
          p_confirm?: string
          p_exhibitor_id?: string
          p_id_exposant?: string
          p_public_identity_id?: string
          p_reason?: string
          p_source?: string
        }
        Returns: Json
      }
      admin_normalize_website: { Args: { p_raw: string }; Returns: Json }
      admin_preview_exhibitor_identity_reconciliation: {
        Args: { p_min_score?: number }
        Returns: {
          category: string
          confidence: string
          group_key: string
          pair_identity_ids: string[]
          pair_key: string
          plan_text: string
          reasons: Json
          recommended_deactivate_slug: string
          recommended_keep_slug: string
          same_domain: boolean
          score: number
          side_deactivate: Json
          side_keep: Json
          status: string
          website_conflict: boolean
        }[]
      }
      admin_preview_exhibitor_identity_reconciliation_groups: {
        Args: {
          p_category?: string
          p_limit?: number
          p_min_score?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          categories: string[]
          category_group: string
          confidence_max: string
          domains: string[]
          group_key: string
          identities: Json
          identities_count: number
          identities_potentially_deactivatable: Json
          identity_ids: string[]
          main_domain: string
          main_name: string
          names: string[]
          plan_text_group: string
          recommended_keep_identity: Json
          recommended_keep_slug: string
          risk_level: string
          score_avg: number
          score_max: number
          sources: string[]
          status_group: string
          statuses: string[]
          total_count: number
          total_crm: number
          total_leads: number
          total_novelties: number
          total_participations: number
          total_teams: number
          warnings: Json
        }[]
      }
      admin_preview_exhibitor_identity_reconciliation_groups_breakdow: {
        Args: { p_min_score?: number }
        Returns: {
          auto_reconcilable: number
          dangerous: number
          groups_total: number
          likely_false_positive: number
          manual_review: number
        }[]
      }
      admin_preview_exhibitor_identity_reconciliation_page: {
        Args: {
          p_category?: string
          p_limit?: number
          p_min_score?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          category: string
          confidence: string
          group_key: string
          pair_identity_ids: string[]
          pair_key: string
          plan_text: string
          reasons: Json
          recommended_deactivate_slug: string
          recommended_keep_slug: string
          same_domain: boolean
          score: number
          side_deactivate: Json
          side_keep: Json
          status: string
          total_count: number
          website_conflict: boolean
        }[]
      }
      admin_preview_exhibitor_identity_reconciliation_status_breakdow: {
        Args: { p_min_score?: number }
        Returns: {
          auto_reconcilable: number
          dangerous: number
          likely_false_positive: number
          manual_review: number
        }[]
      }
      admin_preview_exhibitor_identity_reconciliation_summary: {
        Args: { p_min_score?: number }
        Returns: {
          auto_reconcilable: number
          dangerous: number
          distinct_group_keys: number
          likely_false_positive: number
          manual_review: number
          pairs_analyzed: number
          unique_identities: number
        }[]
      }
      admin_preview_exhibitor_removal: {
        Args: {
          p_exhibitor_id?: string
          p_id_exposant?: string
          p_public_identity_id?: string
          p_source?: string
        }
        Returns: Json
      }
      admin_preview_exhibitor_website_update: {
        Args: {
          p_exhibitor_id?: string
          p_id_exposant?: string
          p_new_website?: string
          p_public_identity_id?: string
          p_source?: string
        }
        Returns: Json
      }
      admin_remove_exhibitor_from_site: {
        Args: {
          p_confirm?: string
          p_exhibitor_id?: string
          p_id_exposant?: string
          p_public_identity_id?: string
          p_reason?: string
          p_source?: string
        }
        Returns: Json
      }
      admin_resolve_identity: {
        Args: {
          p_exhibitor_id: string
          p_id_exposant: string
          p_public_identity_id: string
        }
        Returns: {
          canonical_name: string
          created_at: string
          exhibitor_id: string | null
          id: string
          is_active: boolean
          legacy_exposant_id: string | null
          public_slug: string
          source_type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "exhibitor_public_identities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_exhibitor_website: {
        Args: {
          p_exhibitor_id?: string
          p_id_exposant?: string
          p_new_website?: string
          p_public_identity_id?: string
          p_reason?: string
          p_source?: string
        }
        Returns: Json
      }
      can_add_novelty: {
        Args: { p_event_id: string; p_exhibitor_id: string }
        Returns: Json
      }
      can_publish_novelty: {
        Args: { event_id: string; exhibitor_id: string }
        Returns: boolean
      }
      check_seo_automation_dependencies: { Args: never; Returns: Json }
      check_seo_cron_dependencies: { Args: never; Returns: Json }
      cleanup_expired_claim_tokens: { Args: never; Returns: undefined }
      cleanup_expired_csrf_tokens: { Args: never; Returns: undefined }
      compute_event_enrichissement_score: {
        Args: { p_event_id: string }
        Returns: number
      }
      compute_seo_source_hash: { Args: { p_event_id: string }; Returns: string }
      count_active_leads: { Args: { exhibitor_uuid: string }; Returns: number }
      count_seo_enrichment_eligible: { Args: never; Returns: Json }
      create_exhibitor_with_lock: {
        Args: {
          p_description: string
          p_logo_url: string
          p_name: string
          p_stand_info: string
          p_website: string
        }
        Returns: {
          approved: boolean | null
          campaign_eligible: boolean | null
          campaign_status: string | null
          campaign_stop_reason: string | null
          company_size_signal: string | null
          company_tier: string | null
          contact_email: string | null
          contact_poste: string | null
          contact_prenom: string | null
          contact_score: number | null
          created_at: string | null
          current_step: number | null
          description: string | null
          email_source: string | null
          hunter_search_done: boolean | null
          hunter_verify_done: boolean | null
          id: string
          is_generic_inbox: boolean | null
          is_test: boolean
          last_sent_at: string | null
          linkedin_url: string | null
          logo_url: string | null
          name: string
          name_normalized: string | null
          next_send_date: string | null
          opt_out: boolean | null
          outlook_conv_id: string | null
          outlook_message_id: string | null
          owner_user_id: string | null
          plan: string | null
          pre_hunter_score: number | null
          reply_date: string | null
          reply_status: string | null
          slug: string | null
          stand_info: string | null
          updated_at: string | null
          verified_at: string | null
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "exhibitors"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_missing_outreach_campaigns: { Args: never; Returns: Json }
      create_novelty_atomic: {
        Args: {
          p_brochure_pdf?: string
          p_created_by: string
          p_event_id: string
          p_exhibitor_id: string
          p_images: string[]
          p_pending_exhibitor_id?: string
          p_reason: string
          p_stand_info?: string
          p_title: string
          p_type: string
        }
        Returns: Json
      }
      crm_backfill_match_review: { Args: never; Returns: Json }
      crm_compute_match_review: {
        Args: { p_crm_name: string; p_exhibitor_name: string }
        Returns: {
          name_similarity: number
          needs_review: boolean
          review_reason: string
        }[]
      }
      crm_normalize_company_name: { Args: { p_name: string }; Returns: string }
      crm_run_matching: {
        Args: { p_import_id: string; p_user_id: string }
        Returns: Json
      }
      delete_my_radar_crm_data: { Args: never; Returns: Json }
      delete_user_account: { Args: never; Returns: Json }
      detect_exhibitor_duplicates: {
        Args: { p_include_resolved?: boolean; p_min_score?: number }
        Returns: {
          a_future: number
          a_linkedin: string
          a_name: string
          a_next_event: string
          a_participations: number
          a_slug: string
          a_source: string
          a_website: string
          b_future: number
          b_linkedin: string
          b_name: string
          b_next_event: string
          b_participations: number
          b_slug: string
          b_source: string
          b_website: string
          confidence: string
          identity_a_id: string
          identity_b_id: string
          reasons: Json
          reviewed_at: string
          score: number
          status: string
        }[]
      }
      ensure_exhibitor_public_identity: {
        Args: { p_exhibitor_id?: string; p_legacy_exposant_id?: string }
        Returns: string
      }
      ensure_participation: {
        Args: {
          p_event_id: string
          p_exhibitor_id: string
          p_stand_info: string
        }
        Returns: string
      }
      ensure_user_radar_access: {
        Args: { _user_id: string }
        Returns: {
          access_status: string
          created_at: string
          first_qualified_import_at: string | null
          first_qualified_import_id: string | null
          id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscribed_at: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_radar_access"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      exhibitor_identity_insert_safe: {
        Args: {
          p_base: string
          p_exhibitor: string
          p_force_suffix?: boolean
          p_legacy: string
          p_name: string
          p_source: string
        }
        Returns: string
      }
      exhibitor_slug_next_available: {
        Args: { p_base: string }
        Returns: string
      }
      exhibitor_slug_next_available_from: {
        Args: { p_base: string; p_start: number }
        Returns: string
      }
      exhibitor_slug_normalize: { Args: { p_name: string }; Returns: string }
      export_user_data: { Args: never; Returns: Json }
      extract_event_years: { Args: { p_text: string }; Returns: number[] }
      extract_exhibitor_id_from_logo_path: {
        Args: { object_name: string }
        Returns: string
      }
      extract_root_domain: { Args: { input: string }; Returns: string }
      generate_event_slug: {
        Args: { event_city: string; event_name: string; event_year: number }
        Returns: string
      }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_event_card_stats: {
        Args: { _event_ids: string[] }
        Returns: {
          event_id: string
          exhibitor_count: number
          novelty_count: number
        }[]
      }
      get_exhibitor_ai_enrichment_stats: { Args: never; Returns: Json }
      get_exhibitor_uuid: { Args: { old_id: string }; Returns: string }
      get_location_suggestions: {
        Args: { q: string }
        Returns: {
          label: string
          rank: number
          type: string
          value: string
        }[]
      }
      get_my_exhibitor_alert_status: {
        Args: { p_public_slug: string }
        Returns: Json
      }
      get_novelty_likes_count: {
        Args: { novelty_uuid: string }
        Returns: number
      }
      get_or_create_my_crm_notification_preferences: {
        Args: never
        Returns: {
          created_at: string
          id: string
          last_radar_email_sent_at: string | null
          max_emails_per_week: number
          preferred_alert_timing_days: number
          radar_alerts_enabled: boolean
          radar_email_disabled_at: string | null
          radar_email_enabled: boolean
          radar_email_unsubscribed_at: string | null
          trial_teasers_enabled: boolean
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "crm_notification_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_or_create_my_radar_access: {
        Args: never
        Returns: {
          access_status: string
          created_at: string
          first_qualified_import_at: string | null
          first_qualified_import_id: string | null
          id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscribed_at: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_radar_access"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_outreach_pipeline_stats: { Args: never; Returns: Json }
      get_radar_crm_admin_stats: { Args: never; Returns: Json }
      get_top_novelties_per_event: {
        Args: never
        Returns: {
          audience_tags: string[]
          availability: string
          created_at: string
          demo_slots: Json
          doc_url: string
          event_id: string
          events: Json
          exhibitor_id: string
          exhibitors: Json
          id: string
          media_urls: string[]
          novelty_stats: Json
          reason_1: string
          reason_2: string
          reason_3: string
          stand_info: string
          status: string
          title: string
          type: string
          updated_at: string
        }[]
      }
      get_user_crm_matches: {
        Args: { p_user_id: string }
        Returns: {
          company_id: string
          company_name: string
          company_website: string
          events_count: number
          provider: string
          upcoming_events: Json
        }[]
      }
      get_user_emails_for_moderation: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_user_id_by_email: { Args: { p_email: string }; Returns: string }
      has_active_owner: { Args: { _exhibitor_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_novelty_stat: {
        Args: { p_field: string; p_novelty_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_email_blacklisted: { Args: { _email: string }; Returns: boolean }
      is_team_member: { Args: { _exhibitor_id: string }; Returns: boolean }
      list_exhibitor_profile_change_logs: {
        Args: { p_exhibitor_id?: string; p_limit?: number }
        Returns: {
          actor_role: string
          actor_user_id: string
          changed_fields: string[]
          changes: Json
          created_at: string
          exhibitor_id: string
          id: string
          source: string
        }[]
        SetofOptions: {
          from: "*"
          to: "exhibitor_profile_change_logs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_exposants_to_enrich: {
        Args: { p_limit?: number }
        Returns: {
          exposant_description: string
          id_exposant: string
          nom_exposant: string
          website_exposant: string
        }[]
      }
      list_invalid_exhibitor_websites: {
        Args: never
        Returns: {
          display_name: string
          exhibitor_id: string
          legacy_exposant_id: string
          public_identity_id: string
          public_slug: string
          reason: string
          source_type: string
          website: string
        }[]
      }
      log_application_event: {
        Args: {
          p_details?: Json
          p_function_name?: string
          p_ip_address?: string
          p_level: string
          p_message: string
          p_source?: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: undefined
      }
      normalize_company_name: { Args: { input: string }; Returns: string }
      normalize_domain: { Args: { input_url: string }; Returns: string }
      normalize_event_domain: { Args: { p_url: string }; Returns: string }
      normalize_event_url: { Args: { p_url: string }; Returns: string }
      parse_affluence_int: { Args: { p: string }; Returns: number }
      preview_exhibitor_identity_merge: {
        Args: { p_loser_identity_id: string; p_winner_identity_id: string }
        Returns: Json
      }
      publish_pending_event_atomic: {
        Args: { p_event_data: Json; p_id_event: string }
        Returns: Json
      }
      rebuild_event_duplicate_candidates: {
        Args: { p_only_future?: boolean }
        Returns: Json
      }
      related_events: {
        Args: { p_event_id: string; p_limit?: number }
        Returns: {
          date_debut: string
          date_fin: string
          id: string
          id_event: string
          nom_event: string
          nom_lieu: string
          sectors: string[]
          shared_sectors_count: number
          slug: string
          url_image: string
          ville: string
        }[]
      }
      reset_event_duplicate_candidates: { Args: never; Returns: Json }
      review_exhibitor_duplicate: {
        Args: {
          p_a: string
          p_b: string
          p_confidence?: string
          p_reasons?: Json
          p_score?: number
          p_status: string
        }
        Returns: undefined
      }
      run_exhibitor_ai_remap: { Args: never; Returns: Json }
      scan_event_duplicates: {
        Args: { p_id: string; p_kind: string; p_persist?: boolean }
        Returns: {
          out_match_level: string
          out_matched_date_debut: string
          out_matched_date_fin: string
          out_matched_id: string
          out_matched_id_event: string
          out_matched_kind: string
          out_matched_nom: string
          out_matched_url: string
          out_matched_visible: boolean
          out_reasons: Json
          out_score: number
        }[]
      }
      score_events_batch: {
        Args: { p_dry_run?: boolean; p_limit?: number; p_only_null?: boolean }
        Returns: Json
      }
      search_admin_companies: {
        Args: { lim?: number; q: string }
        Returns: {
          campaign_status: string
          contact_email: string
          current_step: number
          event_id: string
          exhibitor_id: string
          has_exhibitor_row: boolean
          legacy_id: string
          name: string
          outreach_id: string
          relevance: number
          source: string
          source_priority: number
          website: string
        }[]
      }
      search_events: {
        Args: {
          event_types?: string[]
          months?: number[]
          page_num?: number
          page_size?: number
          region_codes?: string[]
          sector_ids?: string[]
        }
        Returns: {
          code_postal: string
          date_debut: string
          date_fin: string
          id: string
          id_event: string
          is_b2b: boolean
          nom_event: string
          nom_lieu: string
          rue: string
          secteur: Json
          slug: string
          total_count: number
          type_event: string
          url_image: string
          url_site_officiel: string
          ville: string
          visible: boolean
        }[]
      }
      search_events_test: {
        Args: {
          event_types?: string[]
          months?: number[]
          page_num?: number
          page_size?: number
          region_codes?: string[]
          sector_ids?: string[]
        }
        Returns: string[]
      }
      seo_eligible_events: {
        Args: { p_only_post_import?: boolean }
        Returns: {
          current_hash: string
          date_debut: string
          description_enrichie_present: boolean
          enrichissement_ignored: boolean
          enrichissement_score: number
          enrichissement_statut: string
          generated_from_hash: string
          id: string
          nom_event: string
          reason: string
          slug: string
          status: string
        }[]
      }
      seo_test_hash_protection: { Args: never; Returns: Json }
      set_exhibitor_alert: {
        Args: {
          p_enabled: boolean
          p_public_slug: string
          p_source_surface?: string
        }
        Returns: Json
      }
      set_seo_vault_secret: {
        Args: { p_name: string; p_value: string }
        Returns: Json
      }
      start_seo_weekly_catchup: { Args: never; Returns: Json }
      sync_exhibitor_public_identities: {
        Args: { p_limit?: number }
        Returns: {
          created_legacy: number
          created_linked: number
          created_modern: number
          skipped_ambiguous: number
        }[]
      }
      toggle_favorite: { Args: { p_event: string }; Returns: undefined }
      track_exhibitor_event: {
        Args: { p_event_type: string; p_metadata?: Json; p_public_slug: string }
        Returns: boolean
      }
      update_exhibitor_public_profile_with_log: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_changed_fields: string[]
          p_changes: Json
          p_exhibitor_id: string
          p_source?: string
          p_update: Json
        }
        Returns: {
          description: string
          id: string
          linkedin_url: string
          logo_url: string
          website: string
        }[]
      }
      update_existing_events_slugs: { Args: never; Returns: undefined }
      update_user_password: {
        Args: { current_password: string; new_password: string }
        Returns: Json
      }
      web_domain: { Args: { p_raw: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      event_type_enum:
        | "salon"
        | "convention"
        | "congres"
        | "conference"
        | "ceremonie"
      exhibitor_team_role: "owner" | "admin"
      exhibitor_team_status: "active" | "invited" | "removed"
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
      exhibitor_team_role: ["owner", "admin"],
      exhibitor_team_status: ["active", "invited", "removed"],
    },
  },
} as const
