# MailMain

MailMain is a Windows desktop email marketing application built with Tauri 2, React, Supabase, and Resend. It provides a visual email template editor, subscriber and list management, manual/scheduled campaigns, and webhook-driven automations.

## Prerequisites

Install these before configuring the project:

- Node.js 20 or newer
- Rust using [rustup](https://rustup.rs/)
- Visual Studio 2022 Build Tools with the **Desktop development with C++** workload and Windows SDK
- A [Supabase](https://supabase.com) project
- A [Resend](https://resend.com) account with a verified sending domain

Install the Supabase CLI locally with the project dependencies:

```powershell
npm install
```

## 1. Configure the Desktop App

Copy the example environment file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` with the public values from **Supabase Dashboard -> Project Settings -> API**:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

`VITE_SUPABASE_ANON_KEY` is safe to use in the desktop application. Do not put the Supabase service-role key in this file.

## 2. Configure Supabase

Authenticate and link the local project to your Supabase project:

```powershell
npx supabase login
npx supabase link --project-ref your-project-ref
```

Apply the database schema and migrations:

```powershell
npx supabase db push
```

Create an administrator account in **Supabase Dashboard -> Authentication -> Users -> Add user**. Sign in through MailMain using that email and password.

## 3. Configure Email Delivery Secrets

Review [supabase/.env.example](supabase/.env.example). Do not copy its values into a tracked file. Set each value directly in the terminal:

```powershell
npx supabase secrets set RESEND_API_KEY="re_your_actual_resend_api_key"
npx supabase secrets set RESEND_FROM_EMAIL="Your Name <mail@your-domain.com>"
npx supabase secrets set WEBHOOK_SECRET="your-long-random-webhook-secret"
npx supabase secrets set UNSUBSCRIBE_SECRET="a-different-long-random-secret"
npx supabase secrets set SCHEDULER_SECRET="a-third-long-random-secret"
```

- `RESEND_API_KEY`: Create this in Resend under **API Keys**.
- `RESEND_FROM_EMAIL`: Must use a verified Resend sender/domain.
- `WEBHOOK_SECRET`: Shared by WordPress or any other webhook source as the `x-webhook-secret` header.
- `UNSUBSCRIBE_SECRET`: Signs secure per-subscriber unsubscribe links.
- `SCHEDULER_SECRET`: Protects the scheduled-campaign dispatcher.

Verify only secret names, never their values:

```powershell
npx supabase secrets list
```

## 4. Deploy Edge Functions

Deploy all functions after configuring secrets:

```powershell
npx supabase functions deploy dispatch-webhook --no-verify-jwt
npx supabase functions deploy dispatch-campaign --no-verify-jwt
npx supabase functions deploy dispatch-scheduled-campaigns --no-verify-jwt
npx supabase functions deploy unsubscribe --no-verify-jwt
```

`dispatch-webhook` is public for external integrations but validates `x-webhook-secret` itself. `unsubscribe` is public because email recipients do not have a Supabase account; it validates a signed unsubscribe token.

## 5. Enable Scheduled Campaigns

In the Supabase SQL Editor, enable the `pg_cron`, `pg_net`, and `supabase_vault` extensions. Store the scheduler secret once:

```sql
select vault.create_secret(
  'replace-with-your-scheduler-secret',
  'mailmain_scheduler_secret'
);
```

Then schedule the once-per-minute dispatcher, replacing the project reference:

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

## 6. Run MailMain

For desktop development:

```powershell
npm run tauri dev
```

For a production frontend build:

```powershell
npm run build
```

## 7. Create a Windows Installer

Build the standalone Windows application and installer:

```powershell
npm run tauri build
```

The build creates a Windows executable and installer under `src-tauri/target/release/bundle/`. Run the generated `.msi` installer to install MailMain without VS Code or a development server. The installed app still needs network access to reach the configured Supabase project and Resend-backed Edge Functions.

## WordPress and RSS Webhooks

See [docs/wordpress-webhook-setup.md](docs/wordpress-webhook-setup.md) for webhook setup, the RSS payload contract, and PowerShell test requests.

A `new_blog_post` webhook posts blog metadata to the selected automation recipient list. Use `{{post_title}}`, `{{post_excerpt}}`, `{{post_url}}`, and `{{post_image_url}}` in a template.

## Git Safety

Real `.env` files are excluded by [.gitignore](.gitignore). The commit-safe configuration references are [.env.example](.env.example) and [supabase/.env.example](supabase/.env.example). Never commit Supabase service-role keys, Resend API keys, or webhook/signing secrets.
