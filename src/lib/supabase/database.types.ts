export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      group_members: {
        Row: {
          animal_group: Database["public"]["Enums"]["animal_group"]
          animal_id: string
          group_id: string
          id: string
          joined_at: string
          mbti: string | null
          nickname: string
          profile_payload: Json
          user_id: string
        }
        Insert: {
          animal_group: Database["public"]["Enums"]["animal_group"]
          animal_id: string
          group_id: string
          id?: string
          joined_at?: string
          mbti?: string | null
          nickname: string
          profile_payload: Json
          user_id: string
        }
        Update: {
          animal_group?: Database["public"]["Enums"]["animal_group"]
          animal_id?: string
          group_id?: string
          id?: string
          joined_at?: string
          mbti?: string | null
          nickname?: string
          profile_payload?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_token_hash: string
          max_members: number
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_token_hash: string
          max_members?: number
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_token_hash?: string
          max_members?: number
          name?: string
        }
        Relationships: []
      }
      relation_unlocks: {
        Row: {
          group_id: string
          id: string
          member_high_id: string
          member_low_id: string
          payment_provider: string
          payment_reference: string | null
          status: Database["public"]["Enums"]["unlock_status"]
          unlocked_at: string | null
          unlocked_by: string
        }
        Insert: {
          group_id: string
          id?: string
          member_high_id: string
          member_low_id: string
          payment_provider: string
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["unlock_status"]
          unlocked_at?: string | null
          unlocked_by: string
        }
        Update: {
          group_id?: string
          id?: string
          member_high_id?: string
          member_low_id?: string
          payment_provider?: string
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["unlock_status"]
          unlocked_at?: string | null
          unlocked_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "relation_unlocks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relation_unlocks_high_member_fk"
            columns: ["group_id", "member_high_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["group_id", "id"]
          },
          {
            foreignKeyName: "relation_unlocks_low_member_fk"
            columns: ["group_id", "member_low_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["group_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _profile_is_valid: {
        Args: {
          p_animal_group: string
          p_animal_id: string
          p_mbti: string
          p_profile_payload: Json
        }
        Returns: boolean
      }
      create_group_and_join: {
        Args: {
          p_animal_group: string
          p_animal_id: string
          p_mbti: string
          p_name: string
          p_nickname: string
          p_profile_payload: Json
        }
        Returns: {
          group_id: string
          invite_token: string
          member_id: string
        }[]
      }
      get_group_invite_preview: {
        Args: { p_invite_token: string }
        Returns: {
          group_id: string
          max_members: number
          member_count: number
          name: string
        }[]
      }
      is_group_member: { Args: { p_group_id: string }; Returns: boolean }
      join_group: {
        Args: {
          p_animal_group: string
          p_animal_id: string
          p_invite_token: string
          p_mbti: string
          p_nickname: string
          p_profile_payload: Json
        }
        Returns: {
          group_id: string
          member_id: string
        }[]
      }
      unlock_relation_mock: {
        Args: { p_group_id: string; p_member_a: string; p_member_b: string }
        Returns: {
          group_id: string
          id: string
          member_high_id: string
          member_low_id: string
          payment_provider: string
          payment_reference: string | null
          status: Database["public"]["Enums"]["unlock_status"]
          unlocked_at: string | null
          unlocked_by: string
        }[]
        SetofOptions: {
          from: "*"
          to: "relation_unlocks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      animal_group: "MOON" | "EARTH" | "SUN"
      unlock_status: "pending" | "unlocked" | "failed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      animal_group: ["MOON", "EARTH", "SUN"],
      unlock_status: ["pending", "unlocked", "failed"],
    },
  },
} as const
