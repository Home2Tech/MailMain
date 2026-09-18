import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const secret = Deno.env.get("UNSUBSCRIBE_SECRET")!;
const encoder = new TextEncoder();
const base64UrlToBytes = (value: string) => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4)), (character) => character.charCodeAt(0));

async function validToken(token: string) {
  const [subscriberId, signature] = token.split(".");
  if (!subscriberId || !signature) return null;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return (await crypto.subtle.verify("HMAC", key, base64UrlToBytes(signature), encoder.encode(subscriberId))) ? subscriberId : null;
}

Deno.serve(async (request) => {
  const token = new URL(request.url).searchParams.get("token");
  const subscriberId = token ? await validToken(token) : null;
  if (!subscriberId) return new Response("Invalid unsubscribe link.", { status: 400, headers: { "Content-Type": "text/plain" } });
  const { error } = await supabase.from("subscribers").update({ status: "unsubscribed" }).eq("id", subscriberId);
  if (error) return new Response("Unable to process your request.", { status: 500, headers: { "Content-Type": "text/plain" } });
  const { error: membershipError } = await supabase.from("subscriber_list_memberships").delete().eq("subscriber_id", subscriberId);
  if (membershipError) return new Response("Unable to process your request.", { status: 500, headers: { "Content-Type": "text/plain" } });
  return new Response("You have been unsubscribed.", { headers: { "Content-Type": "text/plain" } });
});
