-- Supabase schema for the modular email marketing / automation platform.
-- Run via the Supabase SQL editor or `supabase db push`.

create extension if not exists "pgcrypto";

-- 1. Subscribers -------------------------------------------------------
create table if not exists subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  status      text not null default 'pending'
              check (status in ('pending', 'subscribed', 'unsubscribed')),
  list_name   text,
  source      text,           -- e.g. 'wordpress_subscribe_block'
  metadata    jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_subscribers_status on subscribers (status);

-- 2. Email templates -----------------------------------------------------
-- variables: jsonb map of placeholder -> description, used by the UI to
-- render a merge-field helper and by the edge function to validate payloads.
create table if not exists email_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  subject     text not null,
  html_body   text not null,
  text_body   text,
  variables   jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3. Automation rules -----------------------------------------------------
-- Decouples "what happened" (trigger_event) from "what to send" (template_id).
-- conditions: optional jsonb filter (e.g. {"list_name": "newsletter"}) evaluated
-- by the edge function before dispatching.
create table if not exists automation_rules (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  trigger_event  text not null,        -- e.g. 'new_subscriber', 'new_blog_post'
  template_id    uuid not null references email_templates (id) on delete cascade,
  conditions     jsonb default '{}'::jsonb,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_automation_rules_trigger on automation_rules (trigger_event) where is_active;

-- 4. Automation events (delivery log / idempotency) ------------------------
create table if not exists automation_events (
  id               uuid primary key default gen_random_uuid(),
  trigger_event    text not null,
  rule_id          uuid references automation_rules (id) on delete set null,
  subscriber_id    uuid references subscribers (id) on delete set null,
  payload          jsonb,
  status           text not null default 'received'
                   check (status in ('received', 'sent', 'skipped', 'failed')),
  error            text,
  resend_message_id text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_automation_events_trigger on automation_events (trigger_event, created_at desc);

-- Keep updated_at fresh on the mutable tables.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_subscribers_updated_at on subscribers;
create trigger trg_subscribers_updated_at
  before update on subscribers
  for each row execute function set_updated_at();

drop trigger if exists trg_email_templates_updated_at on email_templates;
create trigger trg_email_templates_updated_at
  before update on email_templates
  for each row execute function set_updated_at();

drop trigger if exists trg_automation_rules_updated_at on automation_rules;
create trigger trg_automation_rules_updated_at
  before update on automation_rules
  for each row execute function set_updated_at();

-- Row Level Security --------------------------------------------------------
-- The desktop app should authenticate with a Supabase user (or use the
-- service role only from the Edge Function, never from the client).
alter table subscribers enable row level security;
alter table email_templates enable row level security;
alter table automation_rules enable row level security;
alter table automation_events enable row level security;

create policy "Authenticated users can manage templates"
  on email_templates for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage rules"
  on automation_rules for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can read subscribers"
  on subscribers for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read automation events"
  on automation_events for select
  using (auth.role() = 'authenticated');

-- Note: inserts into subscribers/automation_events from public webhooks go
-- through the Edge Function using the service_role key, which bypasses RLS.
