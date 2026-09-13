-- Claim a campaign exactly once before sending to prevent concurrent duplicate delivery.
create or replace function claim_email_campaign(p_campaign_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean;
begin
  update email_campaigns
  set status = 'sending'
  where id = p_campaign_id
    and status in ('draft', 'scheduled')
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

-- A source event is sent to each matching rule at most once.
alter table automation_events
  add column if not exists source_event_id text;

create unique index if not exists idx_automation_events_rule_source_event
  on automation_events (rule_id, source_event_id)
  where source_event_id is not null;
