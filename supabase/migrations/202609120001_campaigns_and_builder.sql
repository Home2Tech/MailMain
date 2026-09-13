-- Add visual-builder, list, campaign, scheduling, and image-storage support.
-- Apply with: npx supabase db push

create table if not exists subscriber_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscriber_list_memberships (
  subscriber_id uuid not null references subscribers(id) on delete cascade,
  list_id uuid not null references subscriber_lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (subscriber_id, list_id)
);

insert into subscriber_lists (name)
values ('Subscribers')
on conflict (name) do nothing;

alter table email_templates
  add column if not exists content jsonb not null default '[]'::jsonb;

create table if not exists email_campaigns (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references email_templates(id) on delete set null,
  list_id uuid not null references subscriber_lists(id) on delete restrict,
  subject text not null,
  html_body text not null,
  text_body text,
  from_email text not null default 'Demetri @ Blkgradstudent <mail@blkgradstudent.com>',
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  recipient_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists email_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references email_campaigns(id) on delete cascade,
  subscriber_id uuid references subscribers(id) on delete set null,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  resend_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create unique index if not exists idx_email_deliveries_campaign_subscriber
  on email_deliveries (campaign_id, subscriber_id)
  where subscriber_id is not null;

create index if not exists idx_email_campaigns_due
  on email_campaigns (scheduled_for)
  where status = 'scheduled';

create index if not exists idx_email_deliveries_campaign_status
  on email_deliveries (campaign_id, status);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_subscriber_lists_updated_at on subscriber_lists;
create trigger trg_subscriber_lists_updated_at
  before update on subscriber_lists
  for each row execute function set_updated_at();

drop trigger if exists trg_email_campaigns_updated_at on email_campaigns;
create trigger trg_email_campaigns_updated_at
  before update on email_campaigns
  for each row execute function set_updated_at();

alter table subscriber_lists enable row level security;
alter table subscriber_list_memberships enable row level security;
alter table email_campaigns enable row level security;
alter table email_deliveries enable row level security;

create policy "Authenticated users can manage lists"
  on subscriber_lists for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage list memberships"
  on subscriber_list_memberships for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage campaigns"
  on email_campaigns for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can read deliveries"
  on email_deliveries for select
  using (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'email-images',
  'email-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Authenticated users can manage email images"
  on storage.objects for all
  using (bucket_id = 'email-images' and auth.role() = 'authenticated')
  with check (bucket_id = 'email-images' and auth.role() = 'authenticated');

-- Configure this only after the campaign-dispatch function is deployed:
-- select cron.schedule(
--   'dispatch-due-email-campaigns',
--   '* * * * *',
--   $$select net.http_post(
--     url := 'https://your-project-ref.supabase.co/functions/v1/dispatch-campaigns',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
--   );$$
-- );
