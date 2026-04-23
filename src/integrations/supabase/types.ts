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
      announcements: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          dorm_id: string
          id: string
          pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          dorm_id: string
          id?: string
          pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          dorm_id?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      chat_channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_channels: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          dorm_id: string
          id: string
          kind: Database["public"]["Enums"]["channel_kind"]
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          dorm_id: string
          id?: string
          kind?: Database["public"]["Enums"]["channel_kind"]
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          dorm_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["channel_kind"]
          name?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          channel_id: string | null
          created_at: string
          id: string
          sender_id: string
          thread_id: string | null
        }
        Insert: {
          body: string
          channel_id?: string | null
          created_at?: string
          id?: string
          sender_id: string
          thread_id?: string | null
        }
        Update: {
          body?: string
          channel_id?: string | null
          created_at?: string
          id?: string
          sender_id?: string
          thread_id?: string | null
        }
        Relationships: []
      }
      class_sessions: {
        Row: {
          course_id: string
          created_at: string
          ends_at: string
          ics_uid: string | null
          id: string
          location: string | null
          source: string
          starts_at: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          ends_at: string
          ics_uid?: string | null
          id?: string
          location?: string | null
          source?: string
          starts_at: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          ends_at?: string
          ics_uid?: string | null
          id?: string
          location?: string | null
          source?: string
          starts_at?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string | null
          color: string
          created_at: string
          id: string
          instructor: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code?: string | null
          color?: string
          created_at?: string
          id?: string
          instructor?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string | null
          color?: string
          created_at?: string
          id?: string
          instructor?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      direct_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
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
      outage_reports: {
        Row: {
          category_id: string
          created_at: string
          dorm_id: string
          id: string
          note: string | null
          outage_id: string | null
          reported_at: string
          reporter_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          dorm_id: string
          id?: string
          note?: string | null
          outage_id?: string | null
          reported_at?: string
          reporter_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          dorm_id?: string
          id?: string
          note?: string | null
          outage_id?: string | null
          reported_at?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outage_reports_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "utility_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outage_reports_dorm_id_fkey"
            columns: ["dorm_id"]
            isOneToOne: false
            referencedRelation: "dorms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outage_reports_outage_id_fkey"
            columns: ["outage_id"]
            isOneToOne: false
            referencedRelation: "outages"
            referencedColumns: ["id"]
          },
        ]
      }
      outages: {
        Row: {
          category_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string
          dorm_id: string
          ended_at: string | null
          id: string
          severity: Database["public"]["Enums"]["outage_severity"]
          started_at: string
          status: Database["public"]["Enums"]["outage_status"]
          summary: string | null
          updated_at: string
        }
        Insert: {
          category_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by: string
          dorm_id: string
          ended_at?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["outage_severity"]
          started_at?: string
          status?: Database["public"]["Enums"]["outage_status"]
          summary?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string
          dorm_id?: string
          ended_at?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["outage_severity"]
          started_at?: string
          status?: Database["public"]["Enums"]["outage_status"]
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "utility_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outages_dorm_id_fkey"
            columns: ["dorm_id"]
            isOneToOne: false
            referencedRelation: "dorms"
            referencedColumns: ["id"]
          },
        ]
      }
      presence_status: {
        Row: {
          id: string
          message: string | null
          state: Database["public"]["Enums"]["presence_state"]
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message?: string | null
          state?: Database["public"]["Enums"]["presence_state"]
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message?: string | null
          state?: Database["public"]["Enums"]["presence_state"]
          updated_at?: string
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
      todo_items: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          due_at: string | null
          id: string
          list_id: string
          notes: string | null
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          due_at?: string | null
          id?: string
          list_id: string
          notes?: string | null
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          list_id?: string
          notes?: string | null
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "todo_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_lists: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          dorm_id: string | null
          id: string
          name: string
          owner_id: string
          scope: Database["public"]["Enums"]["todo_scope"]
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          dorm_id?: string | null
          id?: string
          name: string
          owner_id: string
          scope: Database["public"]["Enums"]["todo_scope"]
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          dorm_id?: string | null
          id?: string
          name?: string
          owner_id?: string
          scope?: Database["public"]["Enums"]["todo_scope"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_lists_dorm_id_fkey"
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
      utility_categories: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          dorm_id: string
          icon: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["utility_kind"]
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          dorm_id: string
          icon?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["utility_kind"]
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          dorm_id?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["utility_kind"]
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_categories_dorm_id_fkey"
            columns: ["dorm_id"]
            isOneToOne: false
            referencedRelation: "dorms"
            referencedColumns: ["id"]
          },
        ]
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
      can_access_channel: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
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
      channel_kind: "dorm_default" | "topic"
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
      outage_severity: "minor" | "partial" | "major"
      outage_status: "reported" | "confirmed" | "resolved" | "dismissed"
      presence_state: "free" | "busy" | "studying" | "away" | "offline"
      resource_category:
        | "study_room"
        | "kitchen"
        | "laundry"
        | "recreation"
        | "charging"
        | "locker"
        | "equipment"
        | "other"
      todo_scope: "personal" | "dorm"
      utility_kind:
        | "electricity"
        | "water"
        | "internet"
        | "gas"
        | "heating"
        | "security"
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
      channel_kind: ["dorm_default", "topic"],
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
      outage_severity: ["minor", "partial", "major"],
      outage_status: ["reported", "confirmed", "resolved", "dismissed"],
      presence_state: ["free", "busy", "studying", "away", "offline"],
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
      todo_scope: ["personal", "dorm"],
      utility_kind: [
        "electricity",
        "water",
        "internet",
        "gas",
        "heating",
        "security",
        "equipment",
        "other",
      ],
    },
  },
} as const
