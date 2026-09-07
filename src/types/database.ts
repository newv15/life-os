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
      accounts: {
        Row: {
          archived_at: string | null
          created_at: string
          currency: string
          current_balance: number
          id: string
          name: string
          opening_balance: number
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          id?: string
          name: string
          opening_balance?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          id?: string
          name?: string
          opening_balance?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_action_logs: {
        Row: {
          arguments: Json | null
          conversation_id: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          intent: string | null
          message_id: string | null
          result: Json | null
          success: boolean
          tool_name: string
          user_id: string
        }
        Insert: {
          arguments?: Json | null
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          intent?: string | null
          message_id?: string | null
          result?: Json | null
          success: boolean
          tool_name: string
          user_id: string
        }
        Update: {
          arguments?: Json | null
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          intent?: string | null
          message_id?: string | null
          result?: Json | null
          success?: boolean
          tool_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_logs_conversation_fk"
            columns: ["conversation_id", "user_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "ai_action_logs_message_fk"
            columns: ["message_id", "user_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          channel: Database["public"]["Enums"]["ai_channel"]
          created_at: string
          id: string
          last_message_at: string
          telegram_chat_id: number | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["ai_channel"]
          created_at?: string
          id?: string
          last_message_at?: string
          telegram_chat_id?: number | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["ai_channel"]
          created_at?: string
          id?: string
          last_message_at?: string
          telegram_chat_id?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["ai_role"]
          tokens_in: number | null
          tokens_out: number | null
          tool_calls: Json | null
          user_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["ai_role"]
          tokens_in?: number | null
          tokens_out?: number | null
          tool_calls?: Json | null
          user_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["ai_role"]
          tokens_in?: number | null
          tokens_out?: number | null
          tool_calls?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_fk"
            columns: ["conversation_id", "user_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          kind: Database["public"]["Enums"]["automation_kind"]
          last_run_at: string | null
          next_run_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          kind: Database["public"]["Enums"]["automation_kind"]
          last_run_at?: string | null
          next_run_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["automation_kind"]
          last_run_at?: string | null
          next_run_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          ends_on: string | null
          id: string
          period: Database["public"]["Enums"]["budget_period"]
          starts_on: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          period?: Database["public"]["Enums"]["budget_period"]
          starts_on?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          period?: Database["public"]["Enums"]["budget_period"]
          starts_on?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_fk"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_system: boolean
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          kind?: Database["public"]["Enums"]["category_kind"]
          name?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_fk"
            columns: ["parent_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      entity_links: {
        Row: {
          created_at: string
          from_id: string
          from_type: Database["public"]["Enums"]["entity_type"]
          id: string
          relation: string | null
          to_id: string
          to_type: Database["public"]["Enums"]["entity_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          from_id: string
          from_type: Database["public"]["Enums"]["entity_type"]
          id?: string
          relation?: string | null
          to_id: string
          to_type: Database["public"]["Enums"]["entity_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          from_id?: string
          from_type?: Database["public"]["Enums"]["entity_type"]
          id?: string
          relation?: string | null
          to_id?: string
          to_type?: Database["public"]["Enums"]["entity_type"]
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          all_day: boolean
          created_at: string
          created_via: Database["public"]["Enums"]["created_via"]
          description: string | null
          ends_at: string | null
          id: string
          location: string | null
          person_id: string | null
          project_id: string | null
          starts_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          person_id?: string | null
          project_id?: string | null
          starts_at: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          person_id?: string | null
          project_id?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_person_fk"
            columns: ["person_id", "user_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "events_project_fk"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      goal_milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          due_on: string | null
          goal_id: string
          id: string
          position: number
          target_value: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_on?: string | null
          goal_id: string
          id?: string
          position?: number
          target_value?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_on?: string | null
          goal_id?: string
          id?: string
          position?: number
          target_value?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_milestones_goal_fk"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          created_via: Database["public"]["Enums"]["created_via"]
          current_value: number
          deadline: string | null
          description: string | null
          horizon: Database["public"]["Enums"]["goal_horizon"]
          id: string
          metric_unit: string | null
          parent_goal_id: string | null
          start_value: number
          status: Database["public"]["Enums"]["goal_status"]
          target_value: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          current_value?: number
          deadline?: string | null
          description?: string | null
          horizon: Database["public"]["Enums"]["goal_horizon"]
          id?: string
          metric_unit?: string | null
          parent_goal_id?: string | null
          start_value?: number
          status?: Database["public"]["Enums"]["goal_status"]
          target_value?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          current_value?: number
          deadline?: string | null
          description?: string | null
          horizon?: Database["public"]["Enums"]["goal_horizon"]
          id?: string
          metric_unit?: string | null
          parent_goal_id?: string | null
          start_value?: number
          status?: Database["public"]["Enums"]["goal_status"]
          target_value?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_parent_fk"
            columns: ["parent_goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      habit_entries: {
        Row: {
          created_at: string
          done: boolean
          entry_date: string
          habit_id: string
          id: string
          note: string | null
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          entry_date?: string
          habit_id: string
          id?: string
          note?: string | null
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          entry_date?: string
          habit_id?: string
          id?: string
          note?: string | null
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_entries_habit_fk"
            columns: ["habit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      habits: {
        Row: {
          active: boolean
          created_at: string
          created_via: Database["public"]["Enums"]["created_via"]
          days_of_week: number[]
          description: string | null
          frequency: Database["public"]["Enums"]["habit_frequency"]
          goal_id: string | null
          id: string
          name: string
          target_per_period: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          days_of_week?: number[]
          description?: string | null
          frequency?: Database["public"]["Enums"]["habit_frequency"]
          goal_id?: string | null
          id?: string
          name: string
          target_per_period?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          days_of_week?: number[]
          description?: string | null
          frequency?: Database["public"]["Enums"]["habit_frequency"]
          goal_id?: string | null
          id?: string
          name?: string
          target_per_period?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_goal_fk"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      inbox_items: {
        Row: {
          ai_suggestion: Json | null
          created_at: string
          id: string
          promoted_entity_id: string | null
          promoted_entity_type:
            | Database["public"]["Enums"]["entity_type"]
            | null
          raw_text: string
          source: Database["public"]["Enums"]["created_via"]
          status: Database["public"]["Enums"]["inbox_status"]
          triaged_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_suggestion?: Json | null
          created_at?: string
          id?: string
          promoted_entity_id?: string | null
          promoted_entity_type?:
            | Database["public"]["Enums"]["entity_type"]
            | null
          raw_text: string
          source?: Database["public"]["Enums"]["created_via"]
          status?: Database["public"]["Enums"]["inbox_status"]
          triaged_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_suggestion?: Json | null
          created_at?: string
          id?: string
          promoted_entity_id?: string | null
          promoted_entity_type?:
            | Database["public"]["Enums"]["entity_type"]
            | null
          raw_text?: string
          source?: Database["public"]["Enums"]["created_via"]
          status?: Database["public"]["Enums"]["inbox_status"]
          triaged_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          blockers: string | null
          body: string | null
          created_at: string
          created_via: Database["public"]["Enums"]["created_via"]
          energy: number | null
          entry_date: string
          id: string
          mood: number | null
          next_goals: string | null
          reflections: string | null
          updated_at: string
          user_id: string
          wins: string | null
        }
        Insert: {
          blockers?: string | null
          body?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          energy?: number | null
          entry_date?: string
          id?: string
          mood?: number | null
          next_goals?: string | null
          reflections?: string | null
          updated_at?: string
          user_id: string
          wins?: string | null
        }
        Update: {
          blockers?: string | null
          body?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          energy?: number | null
          entry_date?: string
          id?: string
          mood?: number | null
          next_goals?: string | null
          reflections?: string | null
          updated_at?: string
          user_id?: string
          wins?: string | null
        }
        Relationships: []
      }
      list_items: {
        Row: {
          checked_at: string | null
          created_at: string
          created_via: Database["public"]["Enums"]["created_via"]
          id: string
          list_id: string
          position: number
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checked_at?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          id?: string
          list_id: string
          position?: number
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checked_at?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          id?: string
          list_id?: string
          position?: number
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_fk"
            columns: ["list_id", "user_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      lists: {
        Row: {
          archived_at: string | null
          created_at: string
          created_via: Database["public"]["Enums"]["created_via"]
          id: string
          keeps_history: boolean
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          id?: string
          keeps_history?: boolean
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          id?: string
          keeps_history?: boolean
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          active: boolean
          confidence: number
          content: string
          created_at: string
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["entity_type"] | null
          expires_at: string | null
          id: string
          kind: Database["public"]["Enums"]["memory_kind"]
          last_used_at: string | null
          source: Database["public"]["Enums"]["memory_source"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          confidence?: number
          content: string
          created_at?: string
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["entity_type"] | null
          expires_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["memory_kind"]
          last_used_at?: string | null
          source?: Database["public"]["Enums"]["memory_source"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          confidence?: number
          content?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["entity_type"] | null
          expires_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["memory_kind"]
          last_used_at?: string | null
          source?: Database["public"]["Enums"]["memory_source"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          archived_at: string | null
          body: string
          category_id: string | null
          created_at: string
          created_via: Database["public"]["Enums"]["created_via"]
          goal_id: string | null
          id: string
          person_id: string | null
          pinned: boolean
          project_id: string | null
          search_vector: unknown
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          body: string
          category_id?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          goal_id?: string | null
          id?: string
          person_id?: string | null
          pinned?: boolean
          project_id?: string | null
          search_vector?: unknown
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          body?: string
          category_id?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          goal_id?: string | null
          id?: string
          person_id?: string | null
          pinned?: boolean
          project_id?: string | null
          search_vector?: unknown
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_category_fk"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "notes_goal_fk"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "notes_person_fk"
            columns: ["person_id", "user_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "notes_project_fk"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["entity_type"] | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          last_error: string | null
          read_at: string | null
          scheduled_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["entity_type"] | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          last_error?: string | null
          read_at?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["entity_type"] | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          last_error?: string | null
          read_at?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_confirmations: {
        Row: {
          arguments: Json
          conversation_id: string | null
          created_at: string
          expires_at: string
          id: string
          resolution: Database["public"]["Enums"]["confirmation_result"] | null
          resolved_at: string | null
          summary: string
          tool_name: string
          user_id: string
        }
        Insert: {
          arguments: Json
          conversation_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          resolution?: Database["public"]["Enums"]["confirmation_result"] | null
          resolved_at?: string | null
          summary: string
          tool_name: string
          user_id: string
        }
        Update: {
          arguments?: Json
          conversation_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          resolution?: Database["public"]["Enums"]["confirmation_result"] | null
          resolved_at?: string | null
          summary?: string
          tool_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_confirmations_conversation_fk"
            columns: ["conversation_id", "user_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      people: {
        Row: {
          company: string | null
          created_at: string
          created_via: Database["public"]["Enums"]["created_via"]
          email: string | null
          full_name: string
          id: string
          last_interaction_at: string | null
          next_action: string | null
          next_action_at: string | null
          notes: string | null
          phone: string | null
          relationship: string | null
          role: string | null
          telegram_handle: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          email?: string | null
          full_name: string
          id?: string
          last_interaction_at?: string | null
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          phone?: string | null
          relationship?: string | null
          role?: string | null
          telegram_handle?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          email?: string | null
          full_name?: string
          id?: string
          last_interaction_at?: string | null
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          phone?: string | null
          relationship?: string | null
          role?: string | null
          telegram_handle?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          locale: string
          onboarded_at: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          locale?: string
          onboarded_at?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          locale?: string
          onboarded_at?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          created_via: Database["public"]["Enums"]["created_via"]
          deadline: string | null
          description: string | null
          goal_id: string | null
          id: string
          name: string
          priority: Database["public"]["Enums"]["priority_level"]
          started_on: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          deadline?: string | null
          description?: string | null
          goal_id?: string | null
          id?: string
          name: string
          priority?: Database["public"]["Enums"]["priority_level"]
          started_on?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          deadline?: string | null
          description?: string | null
          goal_id?: string | null
          id?: string
          name?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          started_on?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_goal_fk"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      taggables: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          tag_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          tag_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["entity_type"]
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "taggables_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          actual_minutes: number | null
          category_id: string | null
          completed_at: string | null
          created_at: string
          created_via: Database["public"]["Enums"]["created_via"]
          description: string | null
          due_at: string | null
          estimated_minutes: number | null
          goal_id: string | null
          id: string
          position: number
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string | null
          recurrence_parent_id: string | null
          recurrence_rule: Json | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_minutes?: number | null
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          description?: string | null
          due_at?: string | null
          estimated_minutes?: number | null
          goal_id?: string | null
          id?: string
          position?: number
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          recurrence_parent_id?: string | null
          recurrence_rule?: Json | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_minutes?: number | null
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          description?: string | null
          due_at?: string | null
          estimated_minutes?: number | null
          goal_id?: string | null
          id?: string
          position?: number
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          recurrence_parent_id?: string | null
          recurrence_rule?: Json | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_category_fk"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "tasks_goal_fk"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "tasks_project_fk"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "tasks_recurrence_parent_fk"
            columns: ["recurrence_parent_id", "user_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      telegram_accounts: {
        Row: {
          chat_id: number | null
          created_at: string
          id: string
          link_code: string | null
          link_code_expires_at: string | null
          linked_at: string | null
          status: Database["public"]["Enums"]["telegram_link_status"]
          telegram_user_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_id?: number | null
          created_at?: string
          id?: string
          link_code?: string | null
          link_code_expires_at?: string | null
          linked_at?: string | null
          status?: Database["public"]["Enums"]["telegram_link_status"]
          telegram_user_id?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_id?: number | null
          created_at?: string
          id?: string
          link_code?: string | null
          link_code_expires_at?: string | null
          linked_at?: string | null
          status?: Database["public"]["Enums"]["telegram_link_status"]
          telegram_user_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_updates: {
        Row: {
          processed_at: string
          update_id: number
        }
        Insert: {
          processed_at?: string
          update_id: number
        }
        Update: {
          processed_at?: string
          update_id?: number
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          category_id: string | null
          created_at: string
          created_via: Database["public"]["Enums"]["created_via"]
          ended_at: string | null
          id: string
          note: string | null
          project_id: string | null
          started_at: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          ended_at?: string | null
          id?: string
          note?: string | null
          project_id?: string | null
          started_at?: string
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          ended_at?: string | null
          id?: string
          note?: string | null
          project_id?: string | null
          started_at?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_category_fk"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "time_entries_project_fk"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "time_entries_task_fk"
            columns: ["task_id", "user_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          created_via: Database["public"]["Enums"]["created_via"]
          currency: string
          description: string | null
          id: string
          occurred_on: string
          person_id: string | null
          project_id: string | null
          transfer_account_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          currency?: string
          description?: string | null
          id?: string
          occurred_on?: string
          person_id?: string | null
          project_id?: string | null
          transfer_account_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["created_via"]
          currency?: string
          description?: string | null
          id?: string
          occurred_on?: string
          person_id?: string | null
          project_id?: string | null
          transfer_account_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_fk"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_category_fk"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_person_fk"
            columns: ["person_id", "user_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_project_fk"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_transfer_account_fk"
            columns: ["transfer_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_user: {
        Args: { p_full_name?: string; p_user_id: string }
        Returns: undefined
      }
      global_search: {
        Args: { p_limit?: number; p_query: string; p_user_id: string }
        Returns: Database["public"]["CompositeTypes"]["search_result"][]
        SetofOptions: {
          from: "*"
          to: "search_result"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      account_type: "cash" | "bank" | "card" | "savings" | "other"
      ai_channel: "web" | "telegram"
      ai_role: "user" | "assistant" | "tool" | "system"
      automation_kind:
        | "daily_briefing"
        | "daily_review"
        | "weekly_review"
        | "deadline_reminder"
        | "stale_task"
        | "budget_alert"
      budget_period: "weekly" | "monthly" | "yearly"
      category_kind: "expense" | "income" | "task" | "note" | "time"
      confirmation_result: "confirmed" | "rejected" | "expired"
      created_via: "web" | "telegram" | "ai" | "system"
      entity_type:
        | "task"
        | "project"
        | "goal"
        | "goal_milestone"
        | "event"
        | "transaction"
        | "account"
        | "category"
        | "note"
        | "habit"
        | "person"
        | "journal_entry"
        | "inbox_item"
        | "time_entry"
        | "memory"
      goal_horizon: "yearly" | "quarterly" | "monthly" | "weekly"
      goal_status: "active" | "paused" | "done" | "abandoned"
      habit_frequency: "daily" | "weekly" | "custom"
      inbox_status: "pending" | "triaged" | "dismissed"
      memory_kind: "preference" | "routine" | "rule" | "fact"
      memory_source: "ai" | "user"
      notification_channel: "telegram" | "web"
      notification_kind: "reminder" | "digest" | "alert" | "insight"
      notification_status: "pending" | "sent" | "failed" | "cancelled"
      priority_level: "low" | "medium" | "high" | "urgent"
      project_status: "idea" | "active" | "paused" | "done" | "archived"
      task_status: "inbox" | "todo" | "doing" | "blocked" | "done" | "cancelled"
      telegram_link_status: "pending" | "active" | "revoked"
      transaction_type: "income" | "expense" | "transfer"
    }
    CompositeTypes: {
      search_result: {
        entity_type: Database["public"]["Enums"]["entity_type"] | null
        entity_id: string | null
        title: string | null
        snippet: string | null
        occurred_at: string | null
        rank: number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_type: ["cash", "bank", "card", "savings", "other"],
      ai_channel: ["web", "telegram"],
      ai_role: ["user", "assistant", "tool", "system"],
      automation_kind: [
        "daily_briefing",
        "daily_review",
        "weekly_review",
        "deadline_reminder",
        "stale_task",
        "budget_alert",
      ],
      budget_period: ["weekly", "monthly", "yearly"],
      category_kind: ["expense", "income", "task", "note", "time"],
      confirmation_result: ["confirmed", "rejected", "expired"],
      created_via: ["web", "telegram", "ai", "system"],
      entity_type: [
        "task",
        "project",
        "goal",
        "goal_milestone",
        "event",
        "transaction",
        "account",
        "category",
        "note",
        "habit",
        "person",
        "journal_entry",
        "inbox_item",
        "time_entry",
        "memory",
      ],
      goal_horizon: ["yearly", "quarterly", "monthly", "weekly"],
      goal_status: ["active", "paused", "done", "abandoned"],
      habit_frequency: ["daily", "weekly", "custom"],
      inbox_status: ["pending", "triaged", "dismissed"],
      memory_kind: ["preference", "routine", "rule", "fact"],
      memory_source: ["ai", "user"],
      notification_channel: ["telegram", "web"],
      notification_kind: ["reminder", "digest", "alert", "insight"],
      notification_status: ["pending", "sent", "failed", "cancelled"],
      priority_level: ["low", "medium", "high", "urgent"],
      project_status: ["idea", "active", "paused", "done", "archived"],
      task_status: ["inbox", "todo", "doing", "blocked", "done", "cancelled"],
      telegram_link_status: ["pending", "active", "revoked"],
      transaction_type: ["income", "expense", "transfer"],
    },
  },
} as const
