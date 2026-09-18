import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { AutomationRuleRow, EmailTemplateRow, SubscriberListRow } from "../types/database";

const triggerOptions = [
  { value: "new_subscriber", label: "New Subscriber" },
  { value: "new_blog_post", label: "New Blog Post (RSS)" },
  { value: "moved_to_program_list", label: "Moved to Program List" },
];

const emptyDraft = { name: "", trigger_event: triggerOptions[0].value, template_id: "", list_id: "", is_active: true };

export default function WorkflowManager() {
  const [rules, setRules] = useState<AutomationRuleRow[]>([]);
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [lists, setLists] = useState<SubscriberListRow[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [rulesResult, templatesResult, listsResult] = await Promise.all([
      supabase.from("automation_rules").select("*").order("created_at", { ascending: false }),
      supabase.from("email_templates").select("*").order("name"),
      supabase.from("subscriber_lists").select("*").order("name"),
    ]);
    const firstError = rulesResult.error ?? templatesResult.error ?? listsResult.error;
    if (firstError) setError(firstError.message);
    else { setRules(rulesResult.data ?? []); setTemplates(templatesResult.data ?? []); setLists(listsResult.data ?? []); }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  function startNew() { setEditingId(null); setDraft({ ...emptyDraft, template_id: templates[0]?.id ?? "", list_id: "" }); setError(null); }
  function editRule(rule: AutomationRuleRow) { setEditingId(rule.id); setDraft({ name: rule.name, trigger_event: rule.trigger_event, template_id: rule.template_id, list_id: rule.list_id ?? "", is_active: rule.is_active }); setError(null); }

  async function save() {
    const requiresList = draft.trigger_event === "new_blog_post";
    if (!draft.name || !draft.trigger_event || !draft.template_id || (requiresList && !draft.list_id)) { setError(requiresList ? "Rule name, trigger, recipient list, and template are required." : "Rule name, trigger, and template are required."); return; }
    setSaving(true); setError(null);
    const ruleDraft = { ...draft, list_id: draft.list_id || null };
    const result = editingId ? await supabase.from("automation_rules").update(ruleDraft).eq("id", editingId) : await supabase.from("automation_rules").insert(ruleDraft);
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    await loadData();
  }

  async function remove() {
    if (!editingId || !window.confirm("Delete this automation rule?")) return;
    const { error: deleteError } = await supabase.from("automation_rules").delete().eq("id", editingId);
    if (deleteError) setError(deleteError.message); else { startNew(); await loadData(); }
  }

  const triggerLabel = (value: string) => triggerOptions.find((trigger) => trigger.value === value)?.label ?? value;
  const templateName = (templateId: string) => templates.find((template) => template.id === templateId)?.name ?? "No template";
  const isCustomTrigger = !triggerOptions.some((trigger) => trigger.value === draft.trigger_event);
  const requiresList = draft.trigger_event === "new_blog_post";

  return <div className="flex h-full min-h-0 flex-col gap-4"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Automations</h2><p className="text-sm text-slate-500">Connect a trigger to an email template.</p></div><button onClick={startNew} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">New automation</button></div>{error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<div className="grid min-h-[calc(100vh-9.5rem)] flex-1 grid-cols-1 overflow-hidden rounded-lg border border-slate-200 bg-white lg:grid-cols-[220px_minmax(0,1fr)]"><aside className="border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Automations</p>{loading ? <p className="text-sm text-slate-500">Loading...</p> : <div className="space-y-1">{rules.map((rule) => <button key={rule.id} onClick={() => editRule(rule)} className={`w-full rounded-md px-3 py-2 text-left text-sm ${editingId === rule.id ? "bg-white font-semibold shadow-sm" : "hover:bg-slate-200"}`}><span className="block truncate">{rule.name}</span><span className="block truncate text-xs font-normal text-slate-500">{triggerLabel(rule.trigger_event)}</span></button>)}{!rules.length && <p className="px-2 text-sm text-slate-500">No automations yet.</p>}</div>}</aside><section className="min-w-0 p-5"><div className="max-w-2xl"><h3 className="font-semibold">{editingId ? "Edit automation" : "New automation"}</h3><p className="mt-1 text-sm text-slate-500">When a subscriber event is received, MailMain sends the selected template to the email in the webhook payload.</p><div className="mt-6 space-y-5"><label className="block text-sm font-medium">Automation name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Welcome new subscribers" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal focus:border-teal-600 focus:outline-none" /></label>{isCustomTrigger ? <div><div className="flex items-center gap-2 text-sm font-medium">Custom trigger <InfoTooltip /></div><input value={draft.trigger_event} onChange={(event) => setDraft({ ...draft, trigger_event: event.target.value.trim().toLowerCase().replace(/\s+/g, "_") })} placeholder="course_completed" className="mt-1 w-full rounded-md border border-teal-300 px-3 py-2 font-normal focus:border-teal-600 focus:outline-none" /><div className="mt-2 flex items-center justify-between"><span className="text-xs text-slate-500">Webhook event: {draft.trigger_event || "event_name"}</span><button onClick={() => setDraft({ ...draft, trigger_event: triggerOptions[0].value })} className="text-xs font-medium text-teal-700 hover:underline">Use existing trigger</button></div></div> : <div><label className="block text-sm font-medium">Trigger<select value={draft.trigger_event} onChange={(event) => setDraft({ ...draft, trigger_event: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal focus:border-teal-600 focus:outline-none">{triggerOptions.map((trigger) => <option key={trigger.value} value={trigger.value}>{trigger.label}</option>)}</select></label><div className="mt-2 flex items-center gap-2"><button onClick={() => setDraft({ ...draft, trigger_event: "" })} className="text-sm font-semibold text-teal-700 hover:underline">+ New Trigger</button><InfoTooltip /></div></div>}{requiresList && <label className="block text-sm font-medium">Recipient list<select value={draft.list_id} onChange={(event) => setDraft({ ...draft, list_id: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal focus:border-teal-600 focus:outline-none"><option value="" disabled>Select a list...</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">New blog posts send to everyone subscribed to this list.</span></label>}<label className="block text-sm font-medium">Send template<select value={draft.template_id} onChange={(event) => setDraft({ ...draft, template_id: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal focus:border-teal-600 focus:outline-none"><option value="" disabled>Select a template...</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select>{draft.template_id && <span className="mt-1 block text-xs font-normal text-slate-500">Selected: {templateName(draft.template_id)}</span>}</label><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={draft.is_active} onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })} />Active</label><div className="flex gap-2"><button onClick={save} disabled={saving} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">{saving ? "Saving..." : editingId ? "Save changes" : "Create automation"}</button>{editingId && <button onClick={remove} className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Delete</button>}</div></div></div></section></div></div>;
}

function InfoTooltip() {
  const [visible, setVisible] = useState(false);
  return <span className="relative inline-flex" onPointerEnter={() => setVisible(true)} onPointerLeave={() => setVisible(false)}><button type="button" aria-label="New trigger information" aria-describedby="new-trigger-tooltip" onFocus={() => setVisible(true)} onBlur={() => setVisible(false)} className="inline-flex text-slate-400"><Info size={16} /></button>{visible && <span id="new-trigger-tooltip" role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-md bg-slate-900 p-2 text-xs font-normal leading-5 text-white shadow-lg">A new trigger needs an external source, such as WordPress or another app, to POST this exact event name as `trigger_event` to the MailMain webhook.</span>}</span>;
}
