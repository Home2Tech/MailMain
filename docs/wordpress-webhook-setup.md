# WordPress Webhook Setup

This guide connects WordPress events to the `dispatch-webhook` Supabase Edge Function.

## 1. Deploy the Edge Function

Run these commands from the project root:

```powershell
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase functions deploy dispatch-webhook --no-verify-jwt
```

`supabase login` opens a browser sign-in flow. Do not place an access token in this project or send one in chat.

## 2. Set function secrets

Set each secret from the terminal. Use a verified Resend sending address for `RESEND_FROM_EMAIL` and choose a long, random value for `WEBHOOK_SECRET`.

```powershell
npx supabase secrets set RESEND_API_KEY="re_your_resend_api_key"
npx supabase secrets set RESEND_FROM_EMAIL="MailMain <news@your-domain.com>"
npx supabase secrets set WEBHOOK_SECRET="replace-with-a-long-random-secret"
npx supabase secrets set UNSUBSCRIBE_SECRET="replace-with-a-long-random-secret"
npx supabase secrets set SCHEDULER_SECRET="replace-with-a-different-long-random-secret"
```

The Edge Function receives `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Supabase automatically. Never set the service role key in the desktop app's `.env` file.

Verify configuration:

```powershell
npx supabase secrets list
```

## 2a. Enable scheduled campaign delivery

The desktop app stores a scheduled campaign in Supabase. A Supabase Cron job checks once per minute for campaigns that are due and calls the private scheduler function.

1. In the Supabase SQL Editor, enable the `pg_cron` and `pg_net` extensions if they are not already enabled.
2. Store the exact `SCHEDULER_SECRET` value in Supabase Vault. Replace the placeholder before running this once:

```sql
select vault.create_secret(
  'replace-with-the-exact-scheduler-secret',
  'mailmain_scheduler_secret'
);
```

3. Schedule the delivery check. Run this once in the SQL Editor:

```sql
select cron.schedule(
  'mailmain-dispatch-scheduled-campaigns',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/dispatch-scheduled-campaigns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scheduler-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'mailmain_scheduler_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Scheduled delivery is accurate to about one minute. Do not run the scheduling statement more than once; that would create duplicate jobs.

## 3. Create the required template and rule

1. Start the desktop app after its `.env` has a project URL and anon key.
2. In **Templates**, create a template. Example welcome template:

   Subject:

   ```text
   Welcome to our list
   ```

   HTML body:

   ```html
   <p>Hi {{first_name}},</p>
   <p>Thanks for subscribing.</p>
   ```

3. In **Automations**, create a rule:
   - Rule name: `Welcome new subscribers`
   - Trigger: `New Subscriber`
  - Recipient list: select the list the new subscriber should join
   - Action: select the welcome template
   - Active: enabled

The `trigger_event` must be exactly `new_subscriber` for this rule.

## 4. Configure a WordPress subscribe form webhook

Use a WordPress form or webhook automation plugin that supports an HTTP POST after successful form submission. Common choices are WP Webhooks, Uncanny Automator, Fluent Forms, Gravity Forms, or Formidable Forms.

Set the webhook destination URL to:

```text
https://your-project-ref.supabase.co/functions/v1/dispatch-webhook
```

Configure the request:

- Method: `POST`
- Content type: `application/json`
- Header: `x-webhook-secret: <the exact WEBHOOK_SECRET value>`

Use this JSON body, mapping your form fields to `email` and `first_name`:

```json
{
  "trigger_event": "new_subscriber",
  "event_id": "unique-event-id-from-wordpress",
  "email": "{{email}}",
  "list_name": "newsletter",
  "data": {
    "first_name": "{{first_name}}"
  }
}
```

Each plugin uses different placeholder syntax. Replace `{{email}}` and `{{first_name}}` with that plugin's own submitted-field tokens.

Send a stable `event_id` for each source event. When WordPress retries the same event, reuse its same ID; MailMain will skip the duplicate rather than sending another email. Generate a new ID for each new subscription or test.

A successful request returns JSON with `status: "processed"` and the matched rule's delivery result.

## 5. Test the webhook before connecting WordPress

In PowerShell, replace the secret and test recipient:

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "x-webhook-secret" = "replace-with-your-webhook-secret"
}

$body = @{
  trigger_event = "new_subscriber"
  email = "your-test-recipient@example.com"
  list_name = "newsletter"
  data = @{ first_name = "Taylor" }
} | ConvertTo-Json -Depth 3

Invoke-RestMethod `
  -Method Post `
  -Uri "https://your-project-ref.supabase.co/functions/v1/dispatch-webhook" `
  -Headers $headers `
  -Body $body
```

Expected response:

```json
{
  "status": "processed",
  "results": [{ "ruleId": "...", "status": "sent" }]
}
```

If a result is `skipped`, confirm that the workflow is active and its trigger is exactly `new_subscriber`. Check the `automation_events` table in Supabase for the delivery log and any Resend error.

## 6. Connect new-post publishing (optional)

An RSS feed is not a webhook source by itself. To react immediately when a post is published, configure a WordPress automation plugin to trigger on **Post published** and POST to the same function URL with the same headers.

Example body:

```json
{
  "trigger_event": "new_blog_post",
  "event_id": "wordpress-post-{{post_id}}",
  "data": {
    "post_title": "{{post_title}}",
    "post_excerpt": "{{post_excerpt}}",
    "post_url": "{{post_url}}",
    "post_image_url": "{{post_featured_image_url}}"
  }
}
```

Create a `New Blog Post (RSS)` automation in MailMain, select its recipient list, and choose a template containing `{{post_title}}`, `{{post_excerpt}}`, and `{{post_url}}`. Add an **RSS image** block to display `{{post_image_url}}`; its width and alignment are controlled in MailMain.

The function sends this RSS automation to every `subscribed` person in the selected recipient list. It does not use an `email` value from the RSS payload.
