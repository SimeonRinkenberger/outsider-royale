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
      categories: {
        Row: {
          created_at: string
          emoji: string
          id: string
          is_paid: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          emoji?: string
          id: string
          is_paid?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          is_paid?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
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
      game_outsiders: {
        Row: {
          created_at: string
          game_id: string
          id: string
          player_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          player_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_outsiders_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          current_round_number: number
          game_mode: Database["public"]["Enums"]["game_mode"]
          id: string
          imposter_word_id: string | null
          lobby_id: string
          outsider_player_id: string
          secret_word_id: string
          status: Database["public"]["Enums"]["game_status"]
          total_rounds: number
        }
        Insert: {
          created_at?: string
          current_round_number?: number
          game_mode?: Database["public"]["Enums"]["game_mode"]
          id?: string
          imposter_word_id?: string | null
          lobby_id: string
          outsider_player_id: string
          secret_word_id: string
          status?: Database["public"]["Enums"]["game_status"]
          total_rounds?: number
        }
        Update: {
          created_at?: string
          current_round_number?: number
          game_mode?: Database["public"]["Enums"]["game_mode"]
          id?: string
          imposter_word_id?: string | null
          lobby_id?: string
          outsider_player_id?: string
          secret_word_id?: string
          status?: Database["public"]["Enums"]["game_status"]
          total_rounds?: number
        }
        Relationships: [
          {
            foreignKeyName: "games_imposter_word_id_fkey"
            columns: ["imposter_word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
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
          is_spectator: boolean
          joined_at: string
          lobby_id: string
          user_id: string
        }
        Insert: {
          display_name: string
          id?: string
          is_connected?: boolean
          is_host?: boolean
          is_spectator?: boolean
          joined_at?: string
          lobby_id: string
          user_id: string
        }
        Update: {
          display_name?: string
          id?: string
          is_connected?: boolean
          is_host?: boolean
          is_spectator?: boolean
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
      products: {
        Row: {
          android_product_id: string | null
          created_at: string
          description: string | null
          id: string
          ios_product_id: string | null
          is_active: boolean
          name: string
          price_tier: number
          product_key: string
          product_type: Database["public"]["Enums"]["product_type"]
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          android_product_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ios_product_id?: string | null
          is_active?: boolean
          name: string
          price_tier?: number
          product_key: string
          product_type: Database["public"]["Enums"]["product_type"]
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          android_product_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ios_product_id?: string | null
          is_active?: boolean
          name?: string
          price_tier?: number
          product_key?: string
          product_type?: Database["public"]["Enums"]["product_type"]
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          is_guest: boolean
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_guest?: boolean
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_guest?: boolean
        }
        Relationships: []
      }
      purchase_history: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency: string | null
          id: string
          platform: Database["public"]["Enums"]["purchase_platform"]
          product_id: string
          purchased_at: string
          receipt_data: string | null
          status: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          platform: Database["public"]["Enums"]["purchase_platform"]
          product_id: string
          purchased_at?: string
          receipt_data?: string | null
          status?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          platform?: Database["public"]["Enums"]["purchase_platform"]
          product_id?: string
          purchased_at?: string
          receipt_data?: string | null
          status?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      user_entitlements: {
        Row: {
          ai_generations_used: number
          created_at: string
          expires_at: string | null
          granted_at: string
          id: string
          is_active: boolean
          product_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_generations_used?: number
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          is_active?: boolean
          product_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_generations_used?: number
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          is_active?: boolean
          product_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_entitlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stats: {
        Row: {
          best_win_streak: number
          created_at: string
          current_win_streak: number
          favorite_category: string | null
          games_played: number
          games_played_as_outsider: number
          games_played_as_safe: number
          games_won_as_outsider: number
          games_won_as_safe: number
          id: string
          total_clues_submitted: number
          total_correct_votes: number
          total_votes_cast: number
          updated_at: string
          user_id: string
        }
        Insert: {
          best_win_streak?: number
          created_at?: string
          current_win_streak?: number
          favorite_category?: string | null
          games_played?: number
          games_played_as_outsider?: number
          games_played_as_safe?: number
          games_won_as_outsider?: number
          games_won_as_safe?: number
          id?: string
          total_clues_submitted?: number
          total_correct_votes?: number
          total_votes_cast?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          best_win_streak?: number
          created_at?: string
          current_win_streak?: number
          favorite_category?: string | null
          games_played?: number
          games_played_as_outsider?: number
          games_played_as_safe?: number
          games_won_as_outsider?: number
          games_won_as_safe?: number
          id?: string
          total_clues_submitted?: number
          total_correct_votes?: number
          total_votes_cast?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      check_ai_generation_entitlement: {
        Args: { p_user_id: string }
        Returns: {
          ai_generations_used: number
          can_generate: boolean
          free_generations_remaining: number
          is_pro: boolean
        }[]
      }
      check_user_entitlement: {
        Args: { p_product_key: string; p_user_id: string }
        Returns: boolean
      }
      get_imposter_word: {
        Args: { p_categories: string[]; p_secret_word_id: string }
        Returns: {
          category: string
          id: string
          text: string
        }[]
      }
      get_random_words_from_categories: {
        Args: {
          p_categories: string[]
          p_count?: number
          p_exclude_word_id?: string
        }
        Returns: {
          category: string
          id: string
          text: string
        }[]
      }
      grant_entitlement: {
        Args: {
          p_duration_days?: number
          p_product_id: string
          p_user_id: string
        }
        Returns: string
      }
      increment_ai_generation_usage: {
        Args: { p_user_id: string }
        Returns: {
          ai_generations_used: number
          is_pro: boolean
        }[]
      }
    }
    Enums: {
      game_mode: "classic" | "elimination" | "hidden_imposter"
      game_status: "clue_round" | "voting" | "results" | "finished"
      lobby_status: "waiting" | "in_progress" | "voting" | "results"
      product_type: "consumable" | "non_consumable" | "subscription"
      purchase_platform: "ios" | "android" | "web"
      word_category:
        | "brand"
        | "food"
        | "movie"
        | "animal"
        | "place"
        | "thing"
        | "person"
        | "degenerate"
        | "dog_breeds"
        | "birds"
        | "desserts"
        | "car_brands"
        | "ocean_animals"
        | "musical_instruments"
        | "kitchen_appliances"
        | "superheroes"
        | "board_games"
        | "trees"
        | "scientists"
        | "video_game_characters"
        | "tester"
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
      game_mode: ["classic", "elimination", "hidden_imposter"],
      game_status: ["clue_round", "voting", "results", "finished"],
      lobby_status: ["waiting", "in_progress", "voting", "results"],
      product_type: ["consumable", "non_consumable", "subscription"],
      purchase_platform: ["ios", "android", "web"],
      word_category: [
        "brand",
        "food",
        "movie",
        "animal",
        "place",
        "thing",
        "person",
        "degenerate",
        "dog_breeds",
        "birds",
        "desserts",
        "car_brands",
        "ocean_animals",
        "musical_instruments",
        "kitchen_appliances",
        "superheroes",
        "board_games",
        "trees",
        "scientists",
        "video_game_characters",
        "tester",
      ],
    },
  },
} as const
