create table if not exists app_settings (
  id boolean primary key default true check (id),
  rss_feed_url text,
  resend_from_email text not null default 'Your Name <mail@your-domain.com>',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into app_settings (id)
values (true)
on conflict (id) do nothing;

drop trigger if exists trg_app_settings_updated_at on app_settings;
create trigger trg_app_settings_updated_at
  before update on app_settings
  for each row execute function set_updated_at();

alter table app_settings enable row level security;

create policy "Authenticated users can manage app settings"
  on app_settings for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
