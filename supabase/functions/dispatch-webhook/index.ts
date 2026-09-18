import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const resendKey = Deno.env.get("RESEND_API_KEY")!;
const fallbackFromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@example.com";
const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
const unsubscribeSecret = Deno.env.get("UNSUBSCRIBE_SECRET")!;
const unsubscribeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/unsubscribe`;

type Payload = { trigger_event: string; event_id?: string; email?: string; subscriber_id?: string; data?: Record<string, unknown> };
type Recipient = { id: string; email: string; metadata: Record<string, unknown> | null };

function render(template: string, fields: Record<string, unknown>) { return template.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key) => String(fields[key] ?? "")); }
const encoder = new TextEncoder();
const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
async function unsubscribeToken(subscriberId: string) { const key = await crypto.subtle.importKey("raw", encoder.encode(unsubscribeSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(subscriberId)); return `${subscriberId}.${toBase64Url(new Uint8Array(signature))}`; }
function withUnsubscribeFooter(html: string, url: string) { return `${html}<div style="max-width:640px;margin:24px auto 0;padding:16px;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-align:center;border-top:1px solid #e2e8f0">You are receiving this email because you subscribed to this mailing list. <a href="${url}" style="color:#0f766e">Unsubscribe</a></div>`; }

async function send(to: string, subject: string, html: string, text: string | null) {
  const { data } = await supabase.from("app_settings").select("resend_from_email").eq("id", true).maybeSingle();
  const fromEmail = data?.resend_from_email ?? fallbackFromEmail;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: fromEmail, to, subject, html, text: text ?? undefined }) });
  const result = await response.json();
  if (!response.ok) throw new Error(`Resend ${response.status}: ${JSON.stringify(result)}`);
  return result as { id: string };
}

async function defaultSubscriberListId(): Promise<string> {
  const { data: existing, error } = await supabase.from("subscriber_lists").select("id").eq("name", "Subscribers").maybeSingle();
  if (error) throw error;
  if (existing) return existing.id;
  const { data, error: insertError } = await supabase.from("subscriber_lists").insert({ name: "Subscribers" }).select("id").single();
  if (insertError) throw insertError;
  return data.id;
}

async function subscriberForPayload(payload: Payload, listId: string | null): Promise<Recipient | null> {
  let subscriber: Recipient | null = null;
  if (payload.subscriber_id) {
    const { data } = await supabase.from("subscribers").select("id, email, metadata").eq("id", payload.subscriber_id).maybeSingle();
    subscriber = data;
  }
  if (!subscriber && payload.email) {
    const email = payload.email.trim().toLowerCase();
    const { data: existing, error } = await supabase.from("subscribers").select("id, email, metadata").eq("email", email).maybeSingle();
    if (error) throw error;
    if (existing) subscriber = existing;
    else {
      const { data, error: insertError } = await supabase.from("subscribers").insert({ email, status: "subscribed", source: "webhook", metadata: payload.data ?? {} }).select("id, email, metadata").single();
      if (insertError) throw insertError;
      subscriber = data;
    }
  }
  if (!subscriber) return null;
  const membershipListId = listId ?? await defaultSubscriberListId();
  const { error: membershipError } = await supabase.from("subscriber_list_memberships").upsert({ subscriber_id: subscriber.id, list_id: membershipListId });
  if (membershipError) throw membershipError;
  return subscriber;
}

async function sourceEventId(payload: Payload): Promise<string> {
  if (payload.event_id) return payload.event_id;
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function listRecipients(listId: string): Promise<Recipient[]> {
  const { data, error } = await supabase.from("subscriber_list_memberships").select("subscribers!inner(id, email, metadata)").eq("list_id", listId).eq("subscribers.status", "subscribed");
  if (error) throw error;
  return (data ?? []).map((item: { subscribers: Recipient | Recipient[] }) => Array.isArray(item.subscribers) ? item.subscribers[0] : item.subscribers).filter(Boolean);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (webhookSecret && request.headers.get("x-webhook-secret") !== webhookSecret) return new Response("Unauthorized", { status: 401 });
  let payload: Payload;
  try { payload = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!payload.trigger_event) return Response.json({ error: "Missing trigger_event" }, { status: 400 });

  const { data: rules, error: rulesError } = await supabase.from("automation_rules").select("id, trigger_event, template_id, list_id, is_active, email_templates(subject, html_body, text_body)").eq("trigger_event", payload.trigger_event).eq("is_active", true);
  if (rulesError) return Response.json({ error: rulesError.message }, { status: 500 });
  const eventId = await sourceEventId(payload);
  const results: Array<{ ruleId: string; status: string; recipients?: number; error?: string }> = [];

  for (const rule of rules ?? []) {
    const template = Array.isArray(rule.email_templates) ? rule.email_templates[0] : rule.email_templates;
    if (payload.trigger_event === "new_blog_post" && !rule.list_id) { results.push({ ruleId: rule.id, status: "skipped", error: "Rule has no recipient list" }); continue; }
    if (!template) { results.push({ ruleId: rule.id, status: "skipped", error: "Rule has no template" }); continue; }
    try {
      const { data: event, error: eventError } = await supabase.from("automation_events").insert({ trigger_event: payload.trigger_event, rule_id: rule.id, payload, status: "received", source_event_id: eventId }).select("id").single();
      if (eventError?.code === "23505") { results.push({ ruleId: rule.id, status: "skipped", error: "Duplicate source event" }); continue; }
      if (eventError || !event) throw eventError ?? new Error("Unable to reserve source event");
      const recipients = payload.trigger_event === "new_blog_post" ? await listRecipients(rule.list_id) : [await subscriberForPayload(payload, rule.list_id)].filter((recipient): recipient is Recipient => Boolean(recipient));
      if (!recipients.length) { results.push({ ruleId: rule.id, status: "skipped", error: "No eligible recipients" }); continue; }
      for (const recipient of recipients) {
        const unsubscribeTokenValue = await unsubscribeToken(recipient.id);
        const unsubscribeLink = `${unsubscribeUrl}?token=${encodeURIComponent(unsubscribeTokenValue)}`;
        const fields = { ...recipient.metadata, ...payload.data, email: recipient.email, unsubscribe_url: unsubscribeLink };
        const delivered = await send(recipient.email, render(template.subject, fields), withUnsubscribeFooter(render(template.html_body, fields), unsubscribeLink), template.text_body ? render(template.text_body, fields) : null);
        await supabase.from("automation_events").update({ subscriber_id: recipient.id, status: "sent", resend_message_id: delivered.id }).eq("id", event.id);
      }
      results.push({ ruleId: rule.id, status: "sent", recipients: recipients.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase.from("automation_events").update({ status: "failed", error: message }).eq("rule_id", rule.id).eq("source_event_id", eventId);
      results.push({ ruleId: rule.id, status: "failed", error: message });
    }
  }
  return Response.json({ status: "processed", results });
});
