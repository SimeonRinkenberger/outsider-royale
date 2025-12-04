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
      clues: {
        Row: {
          clue_text: string
          created_at: string
          id: string
          player_id: string
          round_id: string
        }
        Insert: {
          clue_text: string
          created_at?: string
          id?: string
          player_id: string
          round_id: string
        }
        Update: {
          clue_text?: string
          created_at?: string
          id?: string
          player_id?: string
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clues_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "lobby_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clues_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          current_round_number: number
          id: string
          lobby_id: string
          outsider_player_id: string
          secret_word_id: string
          status: Database["public"]["Enums"]["game_status"]
          total_rounds: number
        }
        Insert: {
          created_at?: string
          current_round_number?: number
          id?: string
          lobby_id: string
          outsider_player_id: string
          secret_word_id: string
          status?: Database["public"]["Enums"]["game_status"]
          total_rounds?: number
        }
        Update: {
          created_at?: string
          current_round_number?: number
          id?: string
          lobby_id?: string
          outsider_player_id?: string
          secret_word_id?: string
          status?: Database["public"]["Enums"]["game_status"]
          total_rounds?: number
        }
        Relationships: [
          {
            foreignKeyName: "games_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_outsider_player_id_fkey"
            columns: ["outsider_player_id"]
            isOneToOne: false
            referencedRelation: "lobby_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_secret_word_id_fkey"
            columns: ["secret_word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      lobbies: {
        Row: {
          code: string
          created_at: string
          current_game_id: string | null
          host_user_id: string
          id: string
          status: Database["public"]["Enums"]["lobby_status"]
        }
        Insert: {
          code: string
          created_at?: string
          current_game_id?: string | null
          host_user_id: string
          id?: string
          status?: Database["public"]["Enums"]["lobby_status"]
        }
        Update: {
          code?: string
          created_at?: string
          current_game_id?: string | null
          host_user_id?: string
          id?: string
          status?: Database["public"]["Enums"]["lobby_status"]
        }
        Relationships: [
          {
            foreignKeyName: "lobbies_current_game_id_fkey"
            columns: ["current_game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lobbies_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lobby_players: {
        Row: {
          display_name: string
          id: string
          is_connected: boolean
          is_host: boolean
          joined_at: string
          lobby_id: string
          user_id: string
        }
        Insert: {
          display_name: string
          id?: string
          is_connected?: boolean
          is_host?: boolean
          joined_at?: string
          lobby_id: string
          user_id: string
        }
        Update: {
          display_name?: string
          id?: string
          is_connected?: boolean
          is_host?: boolean
          joined_at?: string
          lobby_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lobby_players_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lobby_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          created_at: string
          game_id: string
          id: string
          is_complete: boolean
          round_number: number
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          is_complete?: boolean
          round_number: number
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          is_complete?: boolean
          round_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "rounds_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          created_at: string
          game_id: string
          id: string
          suspected_outsider_player_id: string
          voter_player_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          suspected_outsider_player_id: string
          voter_player_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          suspected_outsider_player_id?: string
          voter_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_suspected_outsider_player_id_fkey"
            columns: ["suspected_outsider_player_id"]
            isOneToOne: false
            referencedRelation: "lobby_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_player_id_fkey"
            columns: ["voter_player_id"]
            isOneToOne: false
            referencedRelation: "lobby_players"
            referencedColumns: ["id"]
          },
        ]
      }
      words: {
        Row: {
          category: Database["public"]["Enums"]["word_category"]
          id: string
          text: string
        }
        Insert: {
          category: Database["public"]["Enums"]["word_category"]
          id?: string
          text: string
        }
        Update: {
          category?: Database["public"]["Enums"]["word_category"]
          id?: string
          text?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      game_status: "clue_round" | "voting" | "results" | "finished"
      lobby_status: "waiting" | "in_progress" | "voting" | "results"
      word_category:
        | "brand"
        | "food"
        | "movie"
        | "animal"
        | "place"
        | "thing"
        | "person"
        | "degenerate"
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
      game_status: ["clue_round", "voting", "results", "finished"],
      lobby_status: ["waiting", "in_progress", "voting", "results"],
      word_category: [
        "brand",
        "food",
        "movie",
        "animal",
        "place",
        "thing",
        "person",
        "degenerate",
      ],
    },
  },
} as const
