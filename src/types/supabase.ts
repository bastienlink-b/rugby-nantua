export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      age_categories: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          id: string
          first_name: string
          last_name: string
          date_of_birth: string
          license_number: string
          can_play_forward: boolean
          can_referee: boolean
          age_category_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          date_of_birth: string
          license_number: string
          can_play_forward?: boolean
          can_referee?: boolean
          age_category_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          date_of_birth?: string
          license_number?: string
          can_play_forward?: boolean
          can_referee?: boolean
          age_category_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_age_category_id_fkey"
            columns: ["age_category_id"]
            referencedRelation: "age_categories"
            referencedColumns: ["id"]
          }
        ]
      }
      coaches: {
        Row: {
          id: string
          first_name: string
          last_name: string
          license_number: string | null
          diploma: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          license_number?: string | null
          diploma?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          license_number?: string | null
          diploma?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      coach_categories: {
        Row: {
          id: string
          coach_id: string
          age_category_id: string
          created_at: string
        }
        Insert: {
          id?: string
          coach_id: string
          age_category_id: string
          created_at?: string
        }
        Update: {
          id?: string
          coach_id?: string
          age_category_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_categories_coach_id_fkey"
            columns: ["coach_id"]
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_categories_age_category_id_fkey"
            columns: ["age_category_id"]
            referencedRelation: "age_categories"
            referencedColumns: ["id"]
          }
        ]
      }
      tournaments: {
        Row: {
          id: string
          date: string
          location: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          date: string
          location: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          location?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tournament_categories: {
        Row: {
          id: string
          tournament_id: string
          age_category_id: string
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          age_category_id: string
          created_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          age_category_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_categories_tournament_id_fkey"
            columns: ["tournament_id"]
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_categories_age_category_id_fkey"
            columns: ["age_category_id"]
            referencedRelation: "age_categories"
            referencedColumns: ["id"]
          }
        ]
      }
      templates: {
        Row: {
          id: string
          name: string
          description: string | null
          file_url: string
          field_mappings: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          file_url: string
          field_mappings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          file_url?: string
          field_mappings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      template_categories: {
        Row: {
          id: string
          template_id: string
          age_category_id: string
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          age_category_id: string
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          age_category_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_categories_template_id_fkey"
            columns: ["template_id"]
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_categories_age_category_id_fkey"
            columns: ["age_category_id"]
            referencedRelation: "age_categories"
            referencedColumns: ["id"]
          }
        ]
      }
      match_sheets: {
        Row: {
          id: string
          tournament_id: string
          template_id: string | null
          age_category_id: string | null
          referent_coach_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          template_id?: string | null
          age_category_id?: string | null
          referent_coach_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          template_id?: string | null
          age_category_id?: string | null
          referent_coach_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_sheets_tournament_id_fkey"
            columns: ["tournament_id"]
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_sheets_template_id_fkey"
            columns: ["template_id"]
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_sheets_age_category_id_fkey"
            columns: ["age_category_id"]
            referencedRelation: "age_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_sheets_referent_coach_id_fkey"
            columns: ["referent_coach_id"]
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          }
        ]
      }
      match_sheet_players: {
        Row: {
          id: string
          match_sheet_id: string
          player_id: string
          created_at: string
        }
        Insert: {
          id?: string
          match_sheet_id: string
          player_id: string
          created_at?: string
        }
        Update: {
          id?: string
          match_sheet_id?: string
          player_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_sheet_players_match_sheet_id_fkey"
            columns: ["match_sheet_id"]
            referencedRelation: "match_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_sheet_players_player_id_fkey"
            columns: ["player_id"]
            referencedRelation: "players"
            referencedColumns: ["id"]
          }
        ]
      }
      match_sheet_coaches: {
        Row: {
          id: string
          match_sheet_id: string
          coach_id: string
          created_at: string
        }
        Insert: {
          id?: string
          match_sheet_id: string
          coach_id: string
          created_at?: string
        }
        Update: {
          id?: string
          match_sheet_id?: string
          coach_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_sheet_coaches_match_sheet_id_fkey"
            columns: ["match_sheet_id"]
            referencedRelation: "match_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_sheet_coaches_coach_id_fkey"
            columns: ["coach_id"]
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}