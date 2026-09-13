alter table automation_rules
  add column if not exists list_id uuid references subscriber_lists(id) on delete restrict;

create index if not exists idx_automation_rules_list_id on automation_rules (list_id);
