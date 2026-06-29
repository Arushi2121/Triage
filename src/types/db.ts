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
      actions: {
        Row: {
          action_type: string
          actor_type: string
          attempted_at: string | null
          completed_at: string | null
          created_at: string
          draft_id: string | null
          error_code: string | null
          error_message: string | null
          id: string
          issue_id: string | null
          payload: Json
          repo_id: string
          response: Json | null
          retry_count: number
          status: string
          target_platform: string
          target_ref: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          actor_type: string
          attempted_at?: string | null
          completed_at?: string | null
          created_at?: string
          draft_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          issue_id?: string | null
          payload: Json
          repo_id: string
          response?: Json | null
          retry_count?: number
          status?: string
          target_platform: string
          target_ref?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          actor_type?: string
          attempted_at?: string | null
          completed_at?: string | null
          created_at?: string
          draft_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          issue_id?: string | null
          payload?: Json
          repo_id?: string
          response?: Json | null
          retry_count?: number
          status?: string
          target_platform?: string
          target_ref?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      classifications: {
        Row: {
          classified_at: string
          confidence: number
          created_at: string
          id: string
          issue_id: string
          issue_type: string
          llm_model: string
          llm_temperature: number
          prompt_version: string
          raw_llm_response: Json
          reasoning: string
          severity: string
          suggested_labels: Json
          token_count_input: number
          token_count_output: number
          updated_at: string
        }
        Insert: {
          classified_at?: string
          confidence: number
          created_at?: string
          id?: string
          issue_id: string
          issue_type: string
          llm_model: string
          llm_temperature: number
          prompt_version?: string
          raw_llm_response: Json
          reasoning: string
          severity: string
          suggested_labels?: Json
          token_count_input: number
          token_count_output: number
          updated_at?: string
        }
        Update: {
          classified_at?: string
          confidence?: number
          created_at?: string
          id?: string
          issue_id?: string
          issue_type?: string
          llm_model?: string
          llm_temperature?: number
          prompt_version?: string
          raw_llm_response?: Json
          reasoning?: string
          severity?: string
          suggested_labels?: Json
          token_count_input?: number
          token_count_output?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classifications_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: true
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      digests: {
        Row: {
          created_at: string
          delivery_action_id: string | null
          generated_at: string
          id: string
          included_repo_ids: Json
          llm_model: string
          llm_temperature: number
          metrics: Json
          period_end: string
          period_start: string
          period_type: string
          prompt_version: string
          raw_llm_response: Json
          sections: Json
          status: string
          summary: string
          title: string
          token_count_input: number
          token_count_output: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_action_id?: string | null
          generated_at?: string
          id?: string
          included_repo_ids: Json
          llm_model: string
          llm_temperature: number
          metrics: Json
          period_end: string
          period_start: string
          period_type: string
          prompt_version?: string
          raw_llm_response: Json
          sections: Json
          status?: string
          summary: string
          title: string
          token_count_input: number
          token_count_output: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_action_id?: string | null
          generated_at?: string
          id?: string
          included_repo_ids?: Json
          llm_model?: string
          llm_temperature?: number
          metrics?: Json
          period_end?: string
          period_start?: string
          period_type?: string
          prompt_version?: string
          raw_llm_response?: Json
          sections?: Json
          status?: string
          summary?: string
          title?: string
          token_count_input?: number
          token_count_output?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "digests_delivery_action_id_fkey"
            columns: ["delivery_action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          classification_id: string
          content: string
          created_at: string
          draft_type: string
          edited_content: string | null
          id: string
          issue_id: string
          llm_model: string
          llm_temperature: number
          prompt_version: string
          raw_llm_response: Json
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: string
          token_count_input: number
          token_count_output: number
          updated_at: string
          version: number
        }
        Insert: {
          classification_id: string
          content: string
          created_at?: string
          draft_type: string
          edited_content?: string | null
          id?: string
          issue_id: string
          llm_model: string
          llm_temperature: number
          prompt_version?: string
          raw_llm_response: Json
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          token_count_input: number
          token_count_output: number
          updated_at?: string
          version?: number
        }
        Update: {
          classification_id?: string
          content?: string
          created_at?: string
          draft_type?: string
          edited_content?: string | null
          id?: string
          issue_id?: string
          llm_model?: string
          llm_temperature?: number
          prompt_version?: string
          raw_llm_response?: Json
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          token_count_input?: number
          token_count_output?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "drafts_classification_id_fkey"
            columns: ["classification_id"]
            isOneToOne: false
            referencedRelation: "classifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      installations: {
        Row: {
          created_at: string
          github_account_id: number
          github_account_login: string
          github_account_type: string
          github_installation_id: number
          github_target_type: string
          id: string
          installed_at: string
          suspended_at: string | null
          uninstalled_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          github_account_id: number
          github_account_login: string
          github_account_type: string
          github_installation_id: number
          github_target_type: string
          id?: string
          installed_at?: string
          suspended_at?: string | null
          uninstalled_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          github_account_id?: number
          github_account_login?: string
          github_account_type?: string
          github_installation_id?: number
          github_target_type?: string
          id?: string
          installed_at?: string
          suspended_at?: string | null
          uninstalled_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_duplicates: {
        Row: {
          confidence: number
          created_at: string
          detected_at: string
          detection_method: string
          duplicate_of_issue_id: string
          id: string
          linked_action_id: string | null
          raw_llm_response: Json | null
          reasoning: string
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          similarity_score: number
          source_issue_id: string
          status: string
          updated_at: string
        }
        Insert: {
          confidence: number
          created_at?: string
          detected_at?: string
          detection_method: string
          duplicate_of_issue_id: string
          id?: string
          linked_action_id?: string | null
          raw_llm_response?: Json | null
          reasoning: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          similarity_score: number
          source_issue_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          detected_at?: string
          detection_method?: string
          duplicate_of_issue_id?: string
          id?: string
          linked_action_id?: string | null
          raw_llm_response?: Json | null
          reasoning?: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          similarity_score?: number
          source_issue_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_duplicates_duplicate_of_issue_id_fkey"
            columns: ["duplicate_of_issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_duplicates_linked_action_id_fkey"
            columns: ["linked_action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_duplicates_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_duplicates_source_issue_id_fkey"
            columns: ["source_issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_patterns: {
        Row: {
          added_at: string
          added_method: string
          confidence: number
          issue_id: string
          pattern_id: string
        }
        Insert: {
          added_at?: string
          added_method: string
          confidence: number
          issue_id: string
          pattern_id: string
        }
        Update: {
          added_at?: string
          added_method?: string
          confidence?: number
          issue_id?: string
          pattern_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_patterns_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_patterns_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          assignees: Json
          author_association: string
          author_github_id: number
          author_github_login: string
          body: string | null
          comments_count: number
          created_at: string
          deleted_at: string | null
          embedded_at: string | null
          embedding: string | null
          embedding_model: string | null
          github_closed_at: string | null
          github_created_at: string
          github_issue_id: number
          github_issue_number: number
          github_node_id: string
          github_updated_at: string
          id: string
          is_pull_request: boolean
          labels: Json
          reactions: Json
          repo_id: string
          state: string
          title: string
          updated_at: string
        }
        Insert: {
          assignees?: Json
          author_association: string
          author_github_id: number
          author_github_login: string
          body?: string | null
          comments_count?: number
          created_at?: string
          deleted_at?: string | null
          embedded_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          github_closed_at?: string | null
          github_created_at: string
          github_issue_id: number
          github_issue_number: number
          github_node_id: string
          github_updated_at: string
          id?: string
          is_pull_request?: boolean
          labels?: Json
          reactions?: Json
          repo_id: string
          state: string
          title: string
          updated_at?: string
        }
        Update: {
          assignees?: Json
          author_association?: string
          author_github_id?: number
          author_github_login?: string
          body?: string | null
          comments_count?: number
          created_at?: string
          deleted_at?: string | null
          embedded_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          github_closed_at?: string | null
          github_created_at?: string
          github_issue_id?: number
          github_issue_number?: number
          github_node_id?: string
          github_updated_at?: string
          id?: string
          is_pull_request?: boolean
          labels?: Json
          reactions?: Json
          repo_id?: string
          state?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repos"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_targets: {
        Row: {
          config: Json
          created_at: string
          credentials_ref: string
          deleted_at: string | null
          id: string
          is_active: boolean
          platform: string
          repo_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          config: Json
          created_at?: string
          credentials_ref: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          platform: string
          repo_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          credentials_ref?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          platform?: string
          repo_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_targets_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      patterns: {
        Row: {
          category: string
          created_at: string
          description: string
          first_detected_at: string
          id: string
          issue_count: number
          last_detected_at: string
          llm_model: string
          llm_temperature: number
          prompt_version: string
          raw_llm_response: Json
          reasoning: string
          repo_id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          severity: string
          status: string
          suggested_actions: Json
          title: string
          token_count_input: number
          token_count_output: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          first_detected_at: string
          id?: string
          issue_count: number
          last_detected_at: string
          llm_model: string
          llm_temperature: number
          prompt_version?: string
          raw_llm_response: Json
          reasoning: string
          repo_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          severity: string
          status?: string
          suggested_actions?: Json
          title: string
          token_count_input: number
          token_count_output: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          first_detected_at?: string
          id?: string
          issue_count?: number
          last_detected_at?: string
          llm_model?: string
          llm_temperature?: number
          prompt_version?: string
          raw_llm_response?: Json
          reasoning?: string
          repo_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          severity?: string
          status?: string
          suggested_actions?: Json
          title?: string
          token_count_input?: number
          token_count_output?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patterns_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patterns_resolved_by_user_id_fkey"
            columns: ["resolved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      repos: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          github_default_branch: string
          github_full_name: string
          github_private: boolean
          github_repo_id: number
          id: string
          installation_id: string
          issue_count_open: number
          language_primary: string | null
          star_count: number
          triage_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          github_default_branch?: string
          github_full_name: string
          github_private?: boolean
          github_repo_id: number
          id?: string
          installation_id: string
          issue_count_open?: number
          language_primary?: string | null
          star_count?: number
          triage_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          github_default_branch?: string
          github_full_name?: string
          github_private?: boolean
          github_repo_id?: number
          id?: string
          installation_id?: string
          issue_count_open?: number
          language_primary?: string | null
          star_count?: number
          triage_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repos_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "installations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string | null
          github_avatar_url: string | null
          github_id: number
          github_username: string
          id: string
          last_active_at: string
          slack_user_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          github_avatar_url?: string | null
          github_id: number
          github_username: string
          id?: string
          last_active_at?: string
          slack_user_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          github_avatar_url?: string | null
          github_id?: number
          github_username?: string
          id?: string
          last_active_at?: string
          slack_user_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_action: string | null
          event_type: string
          github_delivery_id: string
          id: string
          installation_id: string
          issue_id: string | null
          payload: Json
          processed_at: string | null
          processing_error: string | null
          processing_status: string
          received_at: string
          repo_id: string | null
          signature_valid: boolean
        }
        Insert: {
          event_action?: string | null
          event_type: string
          github_delivery_id: string
          id?: string
          installation_id: string
          issue_id?: string | null
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          received_at?: string
          repo_id?: string | null
          signature_valid: boolean
        }
        Update: {
          event_action?: string | null
          event_type?: string
          github_delivery_id?: string
          id?: string
          installation_id?: string
          issue_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          received_at?: string
          repo_id?: string | null
          signature_valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "installations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_similar_issues: {
        Args: {
          exclude_issue_id?: string
          match_limit: number
          query_embedding: string
          similarity_threshold: number
          target_repo_id: string
        }
        Returns: {
          github_created_at: string
          github_issue_id: number
          github_issue_number: number
          id: string
          similarity: number
          state: string
          title: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

// === Domain type aliases ===
// Convenience exports so other files can import { User, UserInsert } from "@/types/db"
// instead of writing Database["public"]["Tables"]["users"]["Row"] every time.

// Users
export type User = Database["public"]["Tables"]["users"]["Row"];
export type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
export type UserUpdate = Database["public"]["Tables"]["users"]["Update"];

// Installations
export type Installation = Database["public"]["Tables"]["installations"]["Row"];
export type InstallationInsert = Database["public"]["Tables"]["installations"]["Insert"];
export type InstallationUpdate = Database["public"]["Tables"]["installations"]["Update"];

// Repos
export type Repo = Database["public"]["Tables"]["repos"]["Row"];
export type RepoInsert = Database["public"]["Tables"]["repos"]["Insert"];
export type RepoUpdate = Database["public"]["Tables"]["repos"]["Update"];

// Notification Targets
export type NotificationTarget = Database["public"]["Tables"]["notification_targets"]["Row"];
export type NotificationTargetInsert = Database["public"]["Tables"]["notification_targets"]["Insert"];
export type NotificationTargetUpdate = Database["public"]["Tables"]["notification_targets"]["Update"];

// Issues
export type Issue = Database["public"]["Tables"]["issues"]["Row"];
export type IssueInsert = Database["public"]["Tables"]["issues"]["Insert"];
export type IssueUpdate = Database["public"]["Tables"]["issues"]["Update"];

// Webhook Events
export type WebhookEvent = Database["public"]["Tables"]["webhook_events"]["Row"];
export type WebhookEventInsert = Database["public"]["Tables"]["webhook_events"]["Insert"];
export type WebhookEventUpdate = Database["public"]["Tables"]["webhook_events"]["Update"];

// Classifications
export type Classification = Database["public"]["Tables"]["classifications"]["Row"];
export type ClassificationInsert = Database["public"]["Tables"]["classifications"]["Insert"];
export type ClassificationUpdate = Database["public"]["Tables"]["classifications"]["Update"];

// Drafts
export type Draft = Database["public"]["Tables"]["drafts"]["Row"];
export type DraftInsert = Database["public"]["Tables"]["drafts"]["Insert"];
export type DraftUpdate = Database["public"]["Tables"]["drafts"]["Update"];

// Actions
export type Action = Database["public"]["Tables"]["actions"]["Row"];
export type ActionInsert = Database["public"]["Tables"]["actions"]["Insert"];
export type ActionUpdate = Database["public"]["Tables"]["actions"]["Update"];

// Issue Duplicates
export type IssueDuplicate = Database["public"]["Tables"]["issue_duplicates"]["Row"];
export type IssueDuplicateInsert = Database["public"]["Tables"]["issue_duplicates"]["Insert"];
export type IssueDuplicateUpdate = Database["public"]["Tables"]["issue_duplicates"]["Update"];

// Patterns
export type Pattern = Database["public"]["Tables"]["patterns"]["Row"];
export type PatternInsert = Database["public"]["Tables"]["patterns"]["Insert"];
export type PatternUpdate = Database["public"]["Tables"]["patterns"]["Update"];

// Issue Patterns
export type IssuePattern = Database["public"]["Tables"]["issue_patterns"]["Row"];
export type IssuePatternInsert = Database["public"]["Tables"]["issue_patterns"]["Insert"];
export type IssuePatternUpdate = Database["public"]["Tables"]["issue_patterns"]["Update"];

// Digests
export type Digest = Database["public"]["Tables"]["digests"]["Row"];
export type DigestInsert = Database["public"]["Tables"]["digests"]["Insert"];
export type DigestUpdate = Database["public"]["Tables"]["digests"]["Update"];
