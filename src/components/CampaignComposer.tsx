import { useEffect, useState } from "react";
import { CalendarClock, Send, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { supabase, supabaseAnonKey, supabaseUrl } from "../lib/supabaseClient";
import type { SubscriberListRow } from "../types/database";

interface CampaignComposerProps { templateId: string | null; subject: string; htmlBody: string; onClose: () => void; }
const defaultSender = "Demetri @ Blkgradstudent <mail@blkgradstudent.com>";

export default function CampaignComposer({ templateId, subject: initialSubject, htmlBody, onClose }: CampaignComposerProps) {
  const [lists, setLists] = useState<SubscriberListRow[]>([]);
  const [listId, setListId] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [sendAt, setSendAt] = useState<"now" | "scheduled">("now");
  const [scheduledFor, setScheduledFor] = useState("");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("subscriber_lists").select("*").order("name").then(({ data, error }) => { if (error) setError(error.message); else { setLists(data ?? []); setListId(data?.[0]?.id ?? ""); } });
  }, []);

  useEffect(() => {
    if (!listId) return;
    supabase.from("subscriber_list_memberships").select("subscriber_id, subscribers!inner(status)", { count: "exact", head: true }).eq("list_id", listId).eq("subscribers.status", "subscribed").then(({ count, error }) => { if (error) setError(error.message); else setRecipientCount(count ?? 0); });
  }, [listId]);

  async function createCampaign() {
    if (!listId || !subject.trim()) { setError("Choose a list and enter a subject."); return; }
    if (sendAt === "scheduled" && !scheduledFor) { setError("Choose a local date and time."); return; }
    setSubmitting(true); setError(null);
    const scheduled = sendAt === "scheduled" ? new Date(scheduledFor).toISOString() : null;
    const status = scheduled ? "scheduled" : "draft";
    const { data, error: createError } = await supabase.from("email_campaigns").insert({ template_id: templateId, list_id: listId, subject: subject.trim(), html_body: htmlBody, from_email: defaultSender, status, scheduled_for: scheduled, recipient_count: recipientCount ?? 0 }).select().single();
    if (createError) { setError(createError.message); setSubmitting(false); return; }
    if (!scheduled) {
      const { data: { session } } = await supabase.auth.getSession();
      try {
        await invoke("dispatch_campaign", { supabaseUrl, anonKey: supabaseAnonKey, accessToken: session?.access_token ?? "", campaignId: data.id });
      } catch (deliveryError) {
        const message = deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
        setError(`Campaign was created, but delivery did not complete: ${message}`); setSubmitting(false); return;
      }
    }
    setSubmitting(false); onClose();
  }

  return <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/35 p-4"><section role="dialog" aria-modal="true" aria-labelledby="campaign-title" className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="campaign-title" className="text-lg font-semibold">Send campaign</h2><p className="mt-1 text-sm text-slate-500">Recipients are managed only in Supabase.</p></div><button onClick={onClose} title="Close" className="p-1 text-slate-500"><X size={20}/></button></div>{error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-5 space-y-4"><label className="block text-sm font-medium">Recipient list<select value={listId} onChange={(e) => setListId(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal">{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label><p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{recipientCount === null ? "Counting recipients..." : `${recipientCount} subscribed recipient${recipientCount === 1 ? "" : "s"}`}</p><label className="block text-sm font-medium">Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" /></label><p className="text-sm text-slate-500">From: {defaultSender}</p><div className="flex rounded-md bg-slate-100 p-1"><button onClick={() => setSendAt("now")} className={`flex-1 rounded px-3 py-2 text-sm font-medium ${sendAt === "now" ? "bg-white shadow-sm" : "text-slate-500"}`}>Send now</button><button onClick={() => setSendAt("scheduled")} className={`flex-1 rounded px-3 py-2 text-sm font-medium ${sendAt === "scheduled" ? "bg-white shadow-sm" : "text-slate-500"}`}>Schedule</button></div>{sendAt === "scheduled" && <label className="block text-sm font-medium">Local delivery time<input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" /></label>}</div>{confirming ? <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-medium">Confirm {sendAt === "now" ? "immediate send" : "schedule"} to {recipientCount ?? 0} recipients?</p><div className="mt-3 flex justify-end gap-2"><button onClick={() => setConfirming(false)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Back</button><button onClick={createCampaign} disabled={submitting || !recipientCount} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{sendAt === "now" ? <Send size={16}/> : <CalendarClock size={16}/>}{submitting ? "Working..." : "Confirm"}</button></div></div> : <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Cancel</button><button onClick={() => setConfirming(true)} disabled={!listId || !subject.trim() || recipientCount === null || recipientCount === 0} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{sendAt === "now" ? <Send size={16}/> : <CalendarClock size={16}/>}{sendAt === "now" ? "Review send" : "Review schedule"}</button></div>}</section></div>;
}
