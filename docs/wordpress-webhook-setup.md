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

## 4. Configure WordPress integrations

Use PHP to send MailMain a subscriber event, and use Uncanny Automator to send a webhook when WordPress publishes a post.

Existing WordPress or Mailchimp subscribers are not automatically backfilled. Import existing contacts from the **Subscribers** page using CSV. Use the generated PHP snippet in **Integrations -> WordPress** for future signups.

Uncanny Automator needs to support an outgoing webhook action with:

- `POST` method
- JSON body
- Custom headers

Some webhook actions or custom headers may require Uncanny Automator Pro depending on your plan.

### 4a. Prepare MailMain

In MailMain:

1. Open **Integrations**.
2. Choose **+ Add Integration -> WordPress**.
3. Copy the **Webhook endpoint**.
4. Open **Settings** and confirm your RSS feed URL is set, for example `https://your-domain.com/feed/`.
5. Open **Automations**.
6. Create or edit a new-subscriber automation if you want welcome emails:
  - Trigger: `New Subscriber`
  - Recipient list: select the list new WordPress subscribers should join
  - Send template: choose your welcome template
  - Active: enabled
7. Create or edit a blog-post automation if you want post emails:
  - Trigger: `New Blog Post (RSS)`
  - Recipient list: choose the list that should receive blog emails
  - Send template: choose your blog-post email template
  - Active: enabled

Your template can use:

- `{{post_title}}`
- `{{post_excerpt}}`
- `{{post_url}}`
- `{{post_image_url}}`, through the RSS image block

### 4b. Configure subscriber sync with PHP

Uncanny Automator's subscriber actions are not required. In MailMain, open **Integrations -> WordPress**, enter the exact `WEBHOOK_SECRET`, and copy the generated PHP snippet. The snippet registers this endpoint on your WordPress site:

```text
https://your-domain.com/wp-json/mailmain/v1/subscribe
```

Use the expandable instructions in MailMain to install the PHP safely with WPCode as a **PHP Snippet**. Do not paste PHP into a WordPress page or post.

Next, choose the subscribe button colors and click **Copy Subscribe Button**. Edit the public signup page in WordPress, add a **Custom HTML** block, and paste the generated form code there. Do not paste the HTML/JavaScript form into the WPCode PHP snippet.

When a visitor submits the form, WordPress validates the email and relays a `new_subscriber` event to Supabase. MailMain creates or finds the subscriber, adds them to the list selected by the active automation, and sends the configured welcome email.

### 4c. Create the Uncanny Automator recipe for posts

Create one recipe for each WordPress post event you want MailMain to receive.

For new blog posts:

1. Install and activate **Uncanny Automator**.
2. Go to **Automator -> Add new**.
3. Choose a recipe type that can run when a post is published. For an admin-published blog post, a logged-in/admin recipe is usually appropriate.
4. Name the recipe, for example `Send new blog post to MailMain`.
5. Add a trigger from **WordPress**.
6. Choose the trigger for a post being published. The exact wording may vary, but it should be similar to:
  - `A user publishes a post`
  - `A post is published`
7. Configure the trigger for the `Post` post type.
8. Add an action for **Webhooks**.
9. Choose the outgoing webhook action. The wording may be similar to:
  - `Send data to a webhook`
  - `Send a webhook to an external URL`

### 4d. Configure the blog-post webhook action

Set the outgoing webhook URL to:

```text
https://your-project-ref.supabase.co/functions/v1/dispatch-webhook
```

Set the request method to `POST`.

Set the data format to `JSON`

In **Headers**, add these rows:

| Name | Value |
| --- | --- |
| `Accept` | `application/json` |
| `Content-Type` | `application/json` |
| `x-webhook-secret` | `<the exact WEBHOOK_SECRET value>` |

In **Body**, add one row per value. Uncanny Automator lets you build nested data by separating keys with `/`, so use `data/post_title` instead of trying to paste a full JSON object into one field.

| Key | Data type | Value |
| --- | --- | --- |
| `trigger_event` | `Text` | `new_blog_post` |
| `event_id` | `Text` | `wordpress-post-` + the WordPress **Post ID** token |
| `data/post_title` | `Text` or `Use a token/custom value` | WordPress **Post title** token |
| `data/post_excerpt` | `Text` or `Use a token/custom value` | WordPress **Post excerpt** token, or a short post-content token |
| `data/post_url` | `Text` or `Use a token/custom value` | WordPress **Post URL** / permalink token |
| `data/post_image_url` | `Text` or `Use a token/custom value` | WordPress **Featured image URL** token |

The generated body must be equivalent to this JSON:

```json
{
  "trigger_event": "new_blog_post",
  "event_id": "wordpress-post-123",
  "data": {
    "post_title": "Example post title",
    "post_excerpt": "Example excerpt",
    "post_url": "https://your-domain.com/example-post/",
    "post_image_url": "https://your-domain.com/example-image.jpg"
  }
}
```

Use the token picker for the values on the right side of the Body table. The exact token names may differ by Uncanny Automator version and recipe trigger.

Use the closest matching tokens:

- `event_id`: WordPress post ID. This must stay the same if the webhook retries the same post.
- `post_title`: post title.
- `post_excerpt`: post excerpt, post content excerpt, or post content summary.
- `post_url`: post permalink.
- `post_image_url`: featured image URL. If Uncanny Automator does not expose this token, leave it blank or use another automation source that can extract the featured image URL.

Send a stable `event_id` for each source event. When WordPress retries the same event, reuse its same ID; MailMain will skip the duplicate rather than sending another email. Generate a new ID for each new subscription or test.

A successful request returns JSON with `status: "processed"` and the matched rule's delivery result.

### 4e. Turn on the recipe

After configuring the trigger and webhook action:

1. Save the recipe.
2. Turn the recipe on.
3. Publish a test post or use Uncanny Automator's test webhook feature if available.
4. Check MailMain's selected test list for the delivered email.
5. Check Supabase `automation_events` if the request was skipped or failed.

## 5. Test the blog-post webhook

Before turning on a live WordPress recipe, use PowerShell to confirm that MailMain receives a `new_blog_post` event and sends the selected template to the automation's recipient list. Replace the webhook secret and sample values:

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "x-webhook-secret" = "replace-with-your-webhook-secret"
}

$body = @{
  trigger_event = "new_blog_post"
  event_id = "manual-test-001"
  data = @{
    post_title = "Example Blog Post"
    post_excerpt = "This is a short test summary that should replace the post excerpt field."
    post_url = "https://your-domain.com/example-blog-post/"
    post_image_url = "https://your-domain.com/path/to/featured-image.jpg"
  }
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
  "results": [{ "ruleId": "...", "status": "sent", "recipients": 1 }]
}
```

If a result is `skipped`, confirm that the automation is active, its trigger is exactly `new_blog_post`, and it has a recipient list with at least one subscribed contact. Check the `automation_events` table in Supabase for the delivery log and any Resend error.

## 6. Other RSS or Webhook Sources

If you are not using WordPress or Uncanny Automator, use any tool that can send an HTTP `POST` request when a new RSS item appears. Examples include Zapier, Make, Pipedream, IFTTT, or a custom scheduled script.

Configure the tool with:

- URL: `https://your-project-ref.supabase.co/functions/v1/dispatch-webhook`
- Method: `POST`
- Header: `Content-Type: application/json`
- Header: `x-webhook-secret: <the exact WEBHOOK_SECRET value>`

Map the RSS item into this JSON shape:

```json
{
  "trigger_event": "new_blog_post",
  "event_id": "{{rss_guid_or_link}}",
  "data": {
    "post_title": "{{rss_title}}",
    "post_excerpt": "{{rss_description}}",
    "post_url": "{{rss_link}}",
    "post_image_url": "{{rss_image_url}}"
  }
}
```

If the RSS tool cannot provide an image URL, omit `post_image_url` and avoid using the RSS image block in that template.
