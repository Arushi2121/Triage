import type { Database, Json } from "./supabase";

// Re-export types used across the codebase
export type { Database, Json };

// === Users ===

export type User = Database["public"]["Tables"]["users"]["Row"];
export type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
export type UserUpdate = Database["public"]["Tables"]["users"]["Update"];

// === Installations ===

export type Installation =
  Database["public"]["Tables"]["installations"]["Row"];
export type InstallationInsert =
  Database["public"]["Tables"]["installations"]["Insert"];
export type InstallationUpdate =
  Database["public"]["Tables"]["installations"]["Update"];

// === Repos ===

export type Repo = Database["public"]["Tables"]["repos"]["Row"];
export type RepoInsert = Database["public"]["Tables"]["repos"]["Insert"];
export type RepoUpdate = Database["public"]["Tables"]["repos"]["Update"];

// === Notification Targets ===

export type NotificationTarget =
  Database["public"]["Tables"]["notification_targets"]["Row"];
export type NotificationTargetInsert =
  Database["public"]["Tables"]["notification_targets"]["Insert"];
export type NotificationTargetUpdate =
  Database["public"]["Tables"]["notification_targets"]["Update"];

// === Issues ===

export type Issue = Database["public"]["Tables"]["issues"]["Row"];
export type IssueInsert = Database["public"]["Tables"]["issues"]["Insert"];
export type IssueUpdate = Database["public"]["Tables"]["issues"]["Update"];

// === Webhook Events ===

export type WebhookEvent =
  Database["public"]["Tables"]["webhook_events"]["Row"];
export type WebhookEventInsert =
  Database["public"]["Tables"]["webhook_events"]["Insert"];
export type WebhookEventUpdate =
  Database["public"]["Tables"]["webhook_events"]["Update"];

// === Classifications ===

export type Classification =
  Database["public"]["Tables"]["classifications"]["Row"];
export type ClassificationInsert =
  Database["public"]["Tables"]["classifications"]["Insert"];
export type ClassificationUpdate =
  Database["public"]["Tables"]["classifications"]["Update"];

// === Drafts ===

export type Draft = Database["public"]["Tables"]["drafts"]["Row"];
export type DraftInsert = Database["public"]["Tables"]["drafts"]["Insert"];
export type DraftUpdate = Database["public"]["Tables"]["drafts"]["Update"];

// === Actions ===

export type Action = Database["public"]["Tables"]["actions"]["Row"];
export type ActionInsert = Database["public"]["Tables"]["actions"]["Insert"];
export type ActionUpdate = Database["public"]["Tables"]["actions"]["Update"];

// === Issue Duplicates ===

export type IssueDuplicate =
  Database["public"]["Tables"]["issue_duplicates"]["Row"];
export type IssueDuplicateInsert =
  Database["public"]["Tables"]["issue_duplicates"]["Insert"];
export type IssueDuplicateUpdate =
  Database["public"]["Tables"]["issue_duplicates"]["Update"];

// === Patterns ===

export type Pattern = Database["public"]["Tables"]["patterns"]["Row"];
export type PatternInsert = Database["public"]["Tables"]["patterns"]["Insert"];
export type PatternUpdate = Database["public"]["Tables"]["patterns"]["Update"];

// === Issue Patterns ===

export type IssuePattern =
  Database["public"]["Tables"]["issue_patterns"]["Row"];
export type IssuePatternInsert =
  Database["public"]["Tables"]["issue_patterns"]["Insert"];
export type IssuePatternUpdate =
  Database["public"]["Tables"]["issue_patterns"]["Update"];

// === Digests ===

export type Digest = Database["public"]["Tables"]["digests"]["Row"];
export type DigestInsert = Database["public"]["Tables"]["digests"]["Insert"];
export type DigestUpdate = Database["public"]["Tables"]["digests"]["Update"];
