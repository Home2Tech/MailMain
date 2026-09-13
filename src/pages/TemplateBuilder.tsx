import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Send } from "lucide-react";
import CampaignComposer from "../components/CampaignComposer";
import EmailCanvas from "../components/EmailCanvas";
import { blocksToHtml, newTextBlock, parseBlocks, type EmailBlock } from "../lib/emailBlocks";
import { supabase } from "../lib/supabaseClient";
import type { EmailTemplateRow } from "../types/database";

export default function TemplateBuilder() {
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [blocks, setBlocks] = useState<EmailBlock[]>([newTextBlock()]);
  const [previewVisible, setPreviewVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const [previewHeight, setPreviewHeight] = useState(480);

  const htmlBody = blocksToHtml(blocks);
  const isEditing = selectedId !== null;

  function resizePreview() {
    const document = previewFrame.current?.contentDocument;
    if (document) setPreviewHeight(Math.max(480, document.documentElement.scrollHeight + 8));
  }

  async function loadTemplates() {
    setLoading(true);
    const { data, error: fetchError } = await supabase.from("email_templates").select("*").order("updated_at", { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setTemplates(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadTemplates(); }, []);

  function selectTemplate(template: EmailTemplateRow) {
    setSelectedId(template.id);
    setName(template.name);
    setSubject(template.subject);
    setBlocks(parseBlocks(template.content, template.html_body));
    setError(null);
  }

  function startNew() {
    setSelectedId(null);
    setName("");
    setSubject("");
    setBlocks([newTextBlock()]);
    setError(null);
  }

  async function handleSave() {
    if (!name.trim() || !subject.trim()) {
      setError("Template name and subject are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = { name: name.trim(), subject: subject.trim(), html_body: htmlBody, text_body: null, content: blocks };
    const result = isEditing
      ? await supabase.from("email_templates").update(payload).eq("id", selectedId)
      : await supabase.from("email_templates").insert(payload);
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    await loadTemplates();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this template? Its automation rules will also be removed.")) return;
    const { error: deleteError } = await supabase.from("email_templates").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else { startNew(); await loadTemplates(); }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-semibold">Email templates</h2><p className="text-sm text-slate-500">Build responsive emails without writing HTML.</p></div>
        <button onClick={startNew} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">New template</button>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid min-h-[calc(100vh-9.5rem)] flex-1 grid-cols-1 overflow-hidden rounded-lg border border-slate-200 bg-white lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Templates</p>
          {loading ? <p className="text-sm text-slate-500">Loading...</p> : <div className="space-y-1">
            {templates.map((template) => <button key={template.id} onClick={() => selectTemplate(template)} className={`w-full rounded-md px-3 py-2 text-left text-sm ${selectedId === template.id ? "bg-white font-semibold shadow-sm" : "hover:bg-slate-200"}`}>{template.name}</button>)}
            {!templates.length && <p className="px-2 text-sm text-slate-500">No templates yet.</p>}
          </div>}
        </aside>

        <section className="min-w-0 p-4 lg:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">{isEditing ? "Edit template" : "New template"}</h3>
            <div className="flex gap-2">
              <button onClick={() => setPreviewVisible((visible) => !visible)} title={previewVisible ? "Hide preview" : "Show preview"} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50">{previewVisible ? <EyeOff size={16} /> : <Eye size={16} />}{previewVisible ? "Hide preview" : "Show preview"}</button>
              <button type="button" onClick={() => setComposerOpen(true)} disabled={!subject.trim()} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"><Send size={16} />Send</button>
            </div>
          </div>

          <div className={`grid gap-5 ${previewVisible ? "2xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
            <div className="min-w-0 space-y-4">
              <label className="block text-sm font-medium">Template name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Monthly newsletter" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal focus:border-teal-600 focus:outline-none" /></label>
              <label className="block text-sm font-medium">Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="A note from Demetri" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal focus:border-teal-600 focus:outline-none" /></label>
              <div><p className="mb-1 text-sm font-medium">Editor</p><EmailCanvas blocks={blocks} onChange={setBlocks} /></div>
              <div className="flex gap-2"><button onClick={handleSave} disabled={saving} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">{saving ? "Saving..." : isEditing ? "Save changes" : "Save template"}</button>{isEditing && <button onClick={() => handleDelete(selectedId)} className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Delete</button>}</div>
            </div>
            {previewVisible && <aside className="min-w-0"><p className="mb-2 text-sm font-semibold">Preview</p><div className="sticky top-5 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-3"><p className="mb-2 truncate rounded bg-white px-3 py-2 text-xs text-slate-500">{subject || "Email subject"}</p><div className="overflow-hidden rounded bg-white shadow-sm"><iframe ref={previewFrame} title="Email preview" srcDoc={htmlBody} onLoad={resizePreview} style={{ height: `${previewHeight}px` }} className="w-full border-0" /></div></div></aside>}
          </div>
        </section>
      </div>
      {composerOpen && <CampaignComposer templateId={selectedId} subject={subject} htmlBody={htmlBody} onClose={() => setComposerOpen(false)} />}
    </div>
  );
}
