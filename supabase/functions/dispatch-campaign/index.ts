import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const resendKey = Deno.env.get("RESEND_API_KEY")!;
const unsubscribeSecret = Deno.env.get("UNSUBSCRIBE_SECRET")!;
const unsubscribeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/unsubscribe`;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const encoder = new TextEncoder();
const bytesToBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

async function unsubscribeToken(subscriberId: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(unsubscribeSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(subscriberId));
  return `${subscriberId}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

function render(template: string, fields: Record<string, unknown>) {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key) => String(fields[key] ?? ""));
}

function withUnsubscribeFooter(html: string, url: string) {
  return `${html}<div style="max-width:640px;margin:24px auto 0;padding:16px;font-family:Arial,sans-serif;font-size:12px;color:#64748b;text-align:center;border-top:1px solid #e2e8f0">You are receiving this email because you subscribed to this mailing list. <a href="${url}" style="color:#0f766e">Unsubscribe</a></div>`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  const authorization = request.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  const { data: { user }, error: authError } = token ? await supabase.auth.getUser(token) : { data: { user: null }, error: null };
  if (authError || !user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  if (!resendKey || !unsubscribeSecret) return Response.json({ error: "Campaign delivery is missing RESEND_API_KEY or UNSUBSCRIBE_SECRET." }, { status: 500, headers: corsHeaders });
  const { campaign_id: campaignId } = await request.json();
  if (!campaignId) return Response.json({ error: "campaign_id is required" }, { status: 400, headers: corsHeaders });

  const { data: campaign, error: campaignError } = await supabase.from("email_campaigns").select("*").eq("id", campaignId).single();
  if (campaignError || !campaign) return Response.json({ error: campaignError?.message ?? "Campaign not found" }, { status: 404, headers: corsHeaders });
  const { data: claimed, error: claimError } = await supabase.rpc("claim_email_campaign", { p_campaign_id: campaignId });
  if (claimError) return Response.json({ error: claimError.message }, { status: 500, headers: corsHeaders });
  if (!claimed) return Response.json({ error: "Campaign has already been dispatched" }, { status: 409, headers: corsHeaders });
  const { data: memberships, error: recipientsError } = await supabase.from("subscriber_list_memberships").select("subscribers!inner(id, email, status, metadata)").eq("list_id", campaign.list_id).eq("subscribers.status", "subscribed");
  if (recipientsError) { await supabase.from("email_campaigns").update({ status: "failed" }).eq("id", campaignId); return Response.json({ error: recipientsError.message }, { status: 500, headers: corsHeaders }); }

  const recipients = (memberships ?? []).map((membership: { subscribers: { id: string; email: string; status: string; metadata: Record<string, unknown> | null } | { id: string; email: string; status: string; metadata: Record<string, unknown> | null }[] }) => Array.isArray(membership.subscribers) ? membership.subscribers[0] : membership.subscribers).filter(Boolean);
  let sent = 0; let failed = 0;
  for (const recipient of recipients) {
    const token = await unsubscribeToken(recipient.id);
    const fields = { ...recipient.metadata, email: recipient.email, unsubscribe_url: `${unsubscribeUrl}?token=${encodeURIComponent(token)}` };
    let response: Response | null = null;
    let result: unknown = null;
    let requestError: string | null = null;
    try {
      response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: campaign.from_email, to: recipient.email, subject: render(campaign.subject, fields), html: withUnsubscribeFooter(render(campaign.html_body, fields), `${unsubscribeUrl}?token=${encodeURIComponent(token)}`), text: campaign.text_body ? render(campaign.text_body, fields) : undefined }), signal: AbortSignal.timeout(20_000) });
      result = await response.json();
    } catch (error) {
      requestError = error instanceof Error ? error.message : String(error);
    }
    const delivered = Boolean(response?.ok);
    const delivery = { campaign_id: campaignId, subscriber_id: recipient.id, email: recipient.email, status: delivered ? "sent" : "failed", resend_message_id: delivered && result && typeof result === "object" && "id" in result ? String(result.id) : null, error: delivered ? null : requestError ?? JSON.stringify(result), sent_at: delivered ? new Date().toISOString() : null };
    await supabase.from("email_deliveries").insert(delivery);
    if (delivered) sent++; else failed++;
  }
  await supabase.from("email_campaigns").update({ status: failed ? "failed" : "sent", sent_at: new Date().toISOString(), recipient_count: recipients.length }).eq("id", campaignId);
  return Response.json({ campaign_id: campaignId, sent, failed }, { headers: corsHeaders });
});
