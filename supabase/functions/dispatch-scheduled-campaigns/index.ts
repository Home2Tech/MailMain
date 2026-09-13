import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const schedulerSecret = Deno.env.get("SCHEDULER_SECRET")!;
const supabase = createClient(url, serviceRoleKey);

Deno.serve(async (request) => {
  if (request.method !== "POST" || request.headers.get("x-scheduler-secret") !== schedulerSecret) return new Response("Unauthorized", { status: 401 });
  const { data: campaigns, error } = await supabase.from("email_campaigns").select("id").eq("status", "scheduled").lte("scheduled_for", new Date().toISOString());
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const results = await Promise.all((campaigns ?? []).map(async ({ id }) => {
    const response = await fetch(`${url}/functions/v1/dispatch-campaign`, { method: "POST", headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ campaign_id: id }) });
    return { id, status: response.status };
  }));
  return Response.json({ dispatched: results });
});
