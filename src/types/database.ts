// Hand-written types mirroring the Supabase schema (see supabase/schema.sql).
// Regenerate with the Supabase CLI (`supabase gen types typescript`) once the project is linked.

export type TriggerEvent =
  | "new_subscriber"
  | "new_blog_post"
  | "moved_to_program_list"
  | string;

export interface EmailTemplateRow {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  variables: Record<string, string> | null;
  content: unknown;
  created_at: string;
  updated_at: string;
}

export interface AutomationRuleRow {
  id: string;
  name: string;
  trigger_event: TriggerEvent;
  template_id: string;
  list_id: string | null;
  conditions: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriberRow {
  id: string;
  email: string;
  status: "pending" | "subscribed" | "unsubscribed";
  list_name: string | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface SubscriberListRow { id: string; name: string; created_at: string; updated_at: string; }
export interface CampaignRow { id: string; template_id: string | null; list_id: string; subject: string; html_body: string; text_body: string | null; from_email: string; status: string; scheduled_for: string | null; recipient_count: number; created_at: string; updated_at: string; }

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      email_templates: {
        Row: EmailTemplateRow;
        Insert: Partial<EmailTemplateRow> & {
          name: string;
          subject: string;
          html_body: string;
        };
        Update: Partial<EmailTemplateRow>;
        Relationships: [];
      };
      automation_rules: {
        Row: AutomationRuleRow;
        Insert: Partial<AutomationRuleRow> & {
          name: string;
          trigger_event: TriggerEvent;
          template_id: string;
        };
        Update: Partial<AutomationRuleRow>;
        Relationships: [];
      };
      subscribers: {
        Row: SubscriberRow;
        Insert: Partial<SubscriberRow> & { email: string };
        Update: Partial<SubscriberRow>;
        Relationships: [];
      };
      subscriber_lists: {
        Row: SubscriberListRow;
        Insert: Partial<SubscriberListRow> & { name: string };
        Update: Partial<SubscriberListRow>;
        Relationships: [];
      };
      subscriber_list_memberships: {
        Row: { subscriber_id: string; list_id: string; created_at: string };
        Insert: { subscriber_id: string; list_id: string };
        Update: never;
        Relationships: [];
      };
      email_campaigns: {
        Row: CampaignRow;
        Insert: Partial<CampaignRow> & { list_id: string; subject: string; html_body: string };
        Update: Partial<CampaignRow>;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
  };
}
