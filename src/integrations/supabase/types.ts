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
      borrow_requests: {
        Row: {
          borrowed_at: string | null
          borrower_id: string
          created_at: string
          dorm_id: string
          id: string
          item_id: string
          notes: string | null
          requested_from: string
          requested_until: string
          returned_at: string | null
          status: Database["public"]["Enums"]["borrow_status"]
          updated_at: string
        }
        Insert: {
          borrowed_at?: string | null
          borrower_id: string
          created_at?: string
          dorm_id: string
          id?: string
          item_id: string
          notes?: string | null
          requested_from: string
          requested_until: string
          returned_at?: string | null
          status?: Database["public"]["Enums"]["borrow_status"]
          updated_at?: string
        }
        Update: {
          borrowed_at?: string | null
          borrower_id?: string
          created_at?: string
          dorm_id?: string
          id?: string
          item_id?: string
          notes?: string | null
          requested_from?: string
          requested_until?: string
          returned_at?: string | null
          status?: Database["public"]["Enums"]["borrow_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "borrow_requests_dorm_id_fkey"
            columns: ["dorm_id"]
            isOneToOne: false
            referencedRelation: "dorms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrow_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      dorm_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          dorm_id: string
          expires_at: string | null
          id: string
          max_uses: number | null
          role_granted: Database["public"]["Enums"]["app_role"]
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          dorm_id: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          role_granted?: Database["public"]["Enums"]["app_role"]
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          dorm_id?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          role_granted?: Database["public"]["Enums"]["app_role"]
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "dorm_invites_dorm_id_fkey"
            columns: ["dorm_id"]
            isOneToOne: false
            referencedRelation: "dorms"
            referencedColumns: ["id"]
          },
        ]
      }
      dorm_members: {
        Row: {
          dorm_id: string
          id: string
          joined_at: string
          room_number: string | null
          user_id: string
        }
        Insert: {
          dorm_id: string
          id?: string
          joined_at?: string
          room_number?: string | null
          user_id: string
        }
        Update: {
          dorm_id?: string
          id?: string
          joined_at?: string
          room_number?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dorm_members_dorm_id_fkey"
            columns: ["dorm_id"]
            isOneToOne: false
            referencedRelation: "dorms"
            referencedColumns: ["id"]
          },
        ]
      }
      dorms: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      issue_attachments: {
        Row: {
          created_at: string
          id: string
          issue_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_id: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_attachments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          assignee_id: string | null
          category: Database["public"]["Enums"]["issue_category"]
          created_at: string
          description: string | null
          dorm_id: string
          id: string
          location: string | null
          priority: Database["public"]["Enums"]["issue_priority"]
          reporter_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          category: Database["public"]["Enums"]["issue_category"]
          created_at?: string
          description?: string | null
          dorm_id: string
          id?: string
          location?: string | null
          priority?: Database["public"]["Enums"]["issue_priority"]
          reporter_id: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          category?: Database["public"]["Enums"]["issue_category"]
          created_at?: string
          description?: string | null
          dorm_id?: string
          id?: string
          location?: string | null
          priority?: Database["public"]["Enums"]["issue_priority"]
          reporter_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_dorm_id_fkey"
            columns: ["dorm_id"]
            isOneToOne: false
            referencedRelation: "dorms"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: Database["public"]["Enums"]["item_category"]
          condition: string | null
          created_at: string
          description: string | null
          dorm_id: string
          id: string
          image_url: string | null
          is_available: boolean
          max_loan_days: number
          name: string
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["item_category"]
          condition?: string | null
          created_at?: string
          description?: string | null
          dorm_id: string
          id?: string
          image_url?: string | null
          is_available?: boolean
          max_loan_days?: number
          name: string
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["item_category"]
          condition?: string | null
          created_at?: string
          description?: string | null
          dorm_id?: string
          id?: string
          image_url?: string | null
          is_available?: boolean
          max_loan_days?: number
          name?: string
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_dorm_id_fkey"
            columns: ["dorm_id"]
            isOneToOne: false
            referencedRelation: "dorms"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resource_bookings: {
        Row: {
          created_at: string
          dorm_id: string
          ends_at: string
          id: string
          purpose: string | null
          resource_id: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dorm_id: string
          ends_at: string
          id?: string
          purpose?: string | null
          resource_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dorm_id?: string
          ends_at?: string
          id?: string
          purpose?: string | null
          resource_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_bookings_dorm_id_fkey"
            columns: ["dorm_id"]
            isOneToOne: false
            referencedRelation: "dorms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_bookings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          capacity: number
          category: Database["public"]["Enums"]["resource_category"]
          close_hour: number
          created_at: string
          default_slot_minutes: number
          description: string | null
          dorm_id: string
          id: string
          image_url: string | null
          is_active: boolean
          max_booking_minutes: number
          name: string
          open_hour: number
          updated_at: string
        }
        Insert: {
          capacity?: number
          category?: Database["public"]["Enums"]["resource_category"]
          close_hour?: number
          created_at?: string
          default_slot_minutes?: number
          description?: string | null
          dorm_id: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_booking_minutes?: number
          name: string
          open_hour?: number
          updated_at?: string
        }
        Update: {
          capacity?: number
          category?: Database["public"]["Enums"]["resource_category"]
          close_hour?: number
          created_at?: string
          default_slot_minutes?: number
          description?: string | null
          dorm_id?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_booking_minutes?: number
          name?: string
          open_hour?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_dorm_id_fkey"
            columns: ["dorm_id"]
            isOneToOne: false
            referencedRelation: "dorms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_trust_stats: {
        Row: {
          currently_overdue: number | null
          late_returns: number | null
          on_time_returns: number | null
          total_borrows: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_dorm_admin_of: {
        Args: { _dorm_id: string; _user_id: string }
        Returns: boolean
      }
      is_dorm_member: {
        Args: { _dorm_id: string; _user_id: string }
        Returns: boolean
      }
      user_dorm_ids: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      app_role: "student" | "dorm_admin" | "system_admin"
      booking_status: "confirmed" | "cancelled" | "completed" | "no_show"
      borrow_status:
        | "requested"
        | "approved"
        | "denied"
        | "borrowed"
        | "returned"
        | "overdue"
        | "cancelled"
      issue_category:
        | "utilities"
        | "maintenance"
        | "noise"
        | "security"
        | "other"
      issue_priority: "low" | "medium" | "high" | "urgent"
      issue_status: "pending" | "in_progress" | "resolved"
      item_category:
        | "electronics"
        | "kitchen"
        | "cleaning"
        | "tools"
        | "books"
        | "sports"
        | "games"
        | "other"
      notification_type:
        | "issue_status"
        | "issue_new"
        | "announcement"
        | "system"
      resource_category:
        | "study_room"
        | "kitchen"
        | "laundry"
        | "recreation"
        | "charging"
        | "locker"
        | "equipment"
        | "other"
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
      app_role: ["student", "dorm_admin", "system_admin"],
      booking_status: ["confirmed", "cancelled", "completed", "no_show"],
      borrow_status: [
        "requested",
        "approved",
        "denied",
        "borrowed",
        "returned",
        "overdue",
        "cancelled",
      ],
      issue_category: [
        "utilities",
        "maintenance",
        "noise",
        "security",
        "other",
      ],
      issue_priority: ["low", "medium", "high", "urgent"],
      issue_status: ["pending", "in_progress", "resolved"],
      item_category: [
        "electronics",
        "kitchen",
        "cleaning",
        "tools",
        "books",
        "sports",
        "games",
        "other",
      ],
      notification_type: [
        "issue_status",
        "issue_new",
        "announcement",
        "system",
      ],
      resource_category: [
        "study_room",
        "kitchen",
        "laundry",
        "recreation",
        "charging",
        "locker",
        "equipment",
        "other",
      ],
    },
  },
} as const
