import { useState } from "react";
import { Code2, Copy, Plus, Rss, Webhook } from "lucide-react";
import { supabaseUrl } from "../lib/supabaseClient";

const webhookUrl = `${supabaseUrl}/functions/v1/dispatch-webhook`;
type IntegrationType = "wordpress" | "custom";
type Config = {
  secret: string;
  buttonBackground: string;
  buttonText: string;
};

export default function IntegrationsManager() {
  const [selected, setSelected] = useState<IntegrationType>("wordpress");
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setMessage("Copied to clipboard.");
  }
  return (
    <section className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Integrations</h2>
          <p className="mt-1 text-sm text-slate-500">
            Connect subscription sources and publishing workflows to MailMain.
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            Add integration
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-2 w-56 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
              <button
                onClick={() => {
                  setSelected("wordpress");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <Rss size={16} />
                WordPress
              </button>
              <button
                onClick={() => {
                  setSelected("custom");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <Webhook size={16} />
                Custom webhook
              </button>
            </div>
          )}
        </div>
      </div>
      {message && (
        <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
          {message}
        </p>
      )}
      <div className="mt-6 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-2">
          <button
            onClick={() => setSelected("wordpress")}
            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${selected === "wordpress" ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white"}`}
          >
            <Rss size={18} />
            <span>
              <span className="block text-sm font-semibold">WordPress</span>
              <span className="text-xs text-slate-500">
                PHP subscribers and post webhooks
              </span>
            </span>
          </button>
          <button
            onClick={() => setSelected("custom")}
            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${selected === "custom" ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white"}`}
          >
            <Webhook size={18} />
            <span>
              <span className="block text-sm font-semibold">Custom</span>
              <span className="text-xs text-slate-500">
                Any webhook-capable source
              </span>
            </span>
          </button>
        </aside>
        <main>
          {selected === "wordpress" ? (
            <WordPressInstructions onCopy={copy} />
          ) : (
            <CustomInstructions onCopy={copy} />
          )}
        </main>
      </div>
    </section>
  );
}

function EndpointBox({ onCopy }: { onCopy: (value: string) => void }) {
  return (
    <div className="mt-3 flex gap-2">
      <input
        readOnly
        value={webhookUrl}
        className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
      />
      <button
        onClick={() => onCopy(webhookUrl)}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
      >
        <Copy size={16} />
        Copy
      </button>
    </div>
  );
}
function ConfigField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm font-normal"
      />
    </label>
  );
}
function InstructionsPanel() {
  return (
    <div className="mt-3 w-full rounded-md border border-teal-200 bg-teal-50 p-5 text-sm text-slate-700">
      <section>
        <h4 className="font-semibold text-slate-900">
          Step 1: Copy Your Setup Code
        </h4>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>
            Ensure the fields above match the WordPress plugin that creates your
            subscribers.
          </li>
          <li>
            Paste your Supabase secret into the <strong>Webhook secret</strong>{" "}
            box.
          </li>
          <li>
            Click the <strong>Copy PHP</strong> button to save the customized
            code to your clipboard.
          </li>
        </ol>
      </section>
      <section className="mt-6 border-t border-teal-200 pt-5">
        <h4 className="font-semibold text-slate-900">
          Step 2: Install the Safe Code Manager
        </h4>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>Log into your WordPress admin dashboard.</li>
          <li>
            On the left-hand menu, navigate to{" "}
            <strong>Plugins &gt; Add New Plugin</strong> (or "Add New").
          </li>
          <li>
            In the search bar at the top right, type{" "}
            <code className="font-mono">WPCode</code>.
          </li>
          <li>
            Look for the exact plugin named{" "}
            <strong>
              "WPCode - Insert Headers and Footers + Custom Co..." by Syed
              Balkhi
            </strong>{" "}
            (it has a blue <code className="font-mono">&lt;/&gt;</code> icon).
          </li>
          <li>
            Click <strong>Install Now</strong>, and then click{" "}
            <strong>Activate</strong>. A new menu item called "Code Snippets"
            will appear in your left sidebar.
          </li>
        </ol>
      </section>
      <section className="mt-6 border-t border-teal-200 pt-5">
        <h4 className="font-semibold text-slate-900">
          Step 3: Add and Activate Your Code
        </h4>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>
            In the left sidebar, click{" "}
            <strong>Code Snippets &gt; Add Snippet</strong>.
          </li>
          <li>
            Hover over "Add Your Custom Code (New Snippet)" and click the{" "}
            <strong>Use snippet</strong> button.
          </li>
          <li>Type "MailMain Webhook Sync" into the title bar at the top.</li>
          <li>
            On the right side of the screen, find the <strong>Code Type</strong>{" "}
            dropdown and change it from "HTML Snippet" to{" "}
            <strong>PHP Snippet</strong>.
          </li>
          <li>Paste your copied code into the large "Code Preview" box.</li>
          <li>
            At the top right, toggle the switch from "Inactive" to{" "}
            <strong>Active</strong>, then click <strong>Save Snippet</strong>.
          </li>
        </ol>
      </section>
      <section className="mt-6 border-t border-teal-200 pt-5">
        <h4 className="font-semibold text-slate-900">
          Step 4: Add the Subscribe Button to Your Page
        </h4>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>
            In MailMain, choose your button background and text colors, then
            click <strong>Copy Subscribe Button</strong>.
          </li>
          <li>
            In WordPress, open the page where you want the signup form and
            click <strong>Edit</strong>.
          </li>
          <li>
            Add a <strong>Custom HTML</strong> block. Do not add this code to the
            WPCode PHP snippet.
          </li>
          <li>
            Paste the copied subscribe button code into the Custom HTML block,
            then save or update the page.
          </li>
        </ol>
      </section>
      <section className="mt-6 border-t border-teal-200 pt-5">
        <h4 className="font-semibold text-slate-900">
          Step 5: Run a Live Test
        </h4>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>
            Open your website as a normal visitor (preferably in an incognito or
            private browsing window).
          </li>
          <li>
            Submit your standard subscriber signup form using a test email
            address.
          </li>
          <li>
            Return to your MailMain dashboard and check the{" "}
            <strong>Subscribers</strong> list to confirm the test email
            successfully synced.
          </li>
        </ol>
      </section>
    </div>
  );
}
function BlogPostInstructions({
  onCopy,
}: {
  onCopy: (value: string) => void;
}) {
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5">
      <h4 className="font-semibold">New blog post via Uncanny Automator</h4>
      <p className="mt-1 text-sm text-slate-500">
        Send published WordPress posts to MailMain with an outgoing webhook.
      </p>
      <h5 className="mt-5 text-sm font-semibold">Webhook endpoint</h5>
      <p className="mt-1 text-sm text-slate-500">
        Uncanny Automator must POST new blog events here with the
        <code className="ml-1 font-mono">x-webhook-secret</code> header.
      </p>
      <EndpointBox onCopy={onCopy} />
      <div className="mt-4 flex items-center justify-between gap-3">
        <h5 className="text-sm font-semibold">Blog post payload</h5>
        <button
          onClick={() => setInstructionsOpen((open) => !open)}
          aria-expanded={instructionsOpen}
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
        >
          {instructionsOpen ? "Hide instructions" : "Instructions"}
        </button>
      </div>
      {instructionsOpen && <BlogPostInstructionsPanel />}
      <pre className="mt-3 overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">{`{
  "trigger_event": "new_blog_post",
  "event_id": "stable-unique-post-id",
  "data": {
    "post_title": "Post title",
    "post_excerpt": "Short summary or RSS description",
    "post_url": "https://example.com/post",
    "post_image_url": "https://example.com/featured-image.jpg"
  }
}`}</pre>
    </article>
  );
}

function BlogPostInstructionsPanel() {
  return (
    <div className="mt-3 w-full rounded-md border border-teal-200 bg-teal-50 p-5 text-sm text-slate-700">
      <section>
        <h5 className="font-semibold text-slate-900">
          Step 1: Create the Uncanny Automator Recipe
        </h5>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>Install and activate <strong>Uncanny Automator</strong>.</li>
          <li>Go to <strong>Automator &gt; Add new</strong>.</li>
          <li>Choose a recipe type that runs when a post is published. For an admin-published post, a logged-in/admin recipe is usually appropriate.</li>
          <li>Name the recipe, for example <code>Send new blog post to MailMain</code>.</li>
          <li>Add a trigger from <strong>WordPress</strong>.</li>
          <li>Choose <code>A user publishes a post</code>, <code>A post is published</code>, or the closest matching trigger.</li>
          <li>Set the post type to <strong>Post</strong>.</li>
          <li>Add a <strong>Webhooks</strong> action and choose the outgoing webhook option.</li>
        </ol>
      </section>
      <section className="mt-6 border-t border-teal-200 pt-5">
        <h5 className="font-semibold text-slate-900">
          Step 2: Configure the Webhook Action
        </h5>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>Copy the webhook endpoint shown above and paste it into the outgoing webhook URL field.</li>
          <li>Set the request method to <strong>POST</strong> and the data format to <strong>JSON</strong>.</li>
          <li>Under Headers, add <code>Accept: application/json</code>, <code>Content-Type: application/json</code>, and <code>x-webhook-secret</code> with the exact <code>WEBHOOK_SECRET</code> value.</li>
          <li>Under Body, add one row for each value. Use slash-separated keys for nested data.</li>
        </ol>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-teal-200"><th className="py-2 pr-3">Key</th><th className="py-2 pr-3">Data type</th><th className="py-2">Value</th></tr></thead>
            <tbody>
              <tr><td className="py-2 pr-3 font-mono">trigger_event</td><td className="pr-3">Text</td><td>new_blog_post</td></tr>
              <tr><td className="py-2 pr-3 font-mono">event_id</td><td className="pr-3">Text</td><td>wordpress-post- + Post ID token</td></tr>
              <tr><td className="py-2 pr-3 font-mono">data/post_title</td><td className="pr-3">Token/custom value</td><td>Post title token</td></tr>
              <tr><td className="py-2 pr-3 font-mono">data/post_excerpt</td><td className="pr-3">Token/custom value</td><td>Post excerpt or content summary token</td></tr>
              <tr><td className="py-2 pr-3 font-mono">data/post_url</td><td className="pr-3">Token/custom value</td><td>Post URL or permalink token</td></tr>
              <tr><td className="py-2 pr-3 font-mono">data/post_image_url</td><td className="pr-3">Token/custom value</td><td>Featured image URL token</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-6 border-t border-teal-200 pt-5">
        <h5 className="font-semibold text-slate-900">Step 3: Turn On and Test the Recipe</h5>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>Save the recipe and turn it on.</li>
          <li>Publish a test post, or use Uncanny Automator's test webhook feature if available.</li>
          <li>Check the recipient list selected by your MailMain <strong>New Blog Post</strong> automation for the delivered email.</li>
          <li>If the request is skipped or fails, check the <code>automation_events</code> table in Supabase.</li>
        </ol>
        <p className="mt-4">Use a stable WordPress Post ID for <code>event_id</code>. Reusing it on a retry prevents duplicate emails.</p>
      </section>
    </div>
  );
}

function WordPressInstructions({
  onCopy,
}: {
  onCopy: (value: string) => void;
}) {
  const [config, setConfig] = useState<Config>({
    secret: "",
    buttonBackground: "#ff6767",
    buttonText: "#5c1919",
  });
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const php = `<?php
// Register the custom REST API route
add_action('rest_api_init', function () {
    register_rest_route('mailmain/v1', '/subscribe', array(
        'methods' => 'POST',
        'callback' => 'relay_to_supabase_webhook',
        'permission_callback' => '__return_true'
    ));
});

// The function that processes the request
function relay_to_supabase_webhook($request) {
    $email = sanitize_email($request->get_param('email'));

    if (!$email) {
        return new WP_Error('invalid_email', 'A valid email is required.', array('status' => 400));
    }

    $webhook_url = '${webhookUrl}';
    $webhook_secret = '${config.secret || "YOUR_SECRET_HERE"}'; // <-- Double check this matches your PS script!

    // Build payload matching your PowerShell script
    $body = array(
        'trigger_event' => 'new_subscriber',
        'event_id'      => 'wordpress-subscriber-' . time(),
        'email'         => $email,
        'data'          => array(
            'first_name' => sanitize_text_field($request->get_param('first_name')),
            'last_name'  => sanitize_text_field($request->get_param('last_name'))
        )
    );

    // Relay to Supabase
    $response = wp_remote_post($webhook_url, array(
        'method'      => 'POST',
        'timeout'     => 15,
        'headers'     => array(
            'Content-Type'     => 'application/json',
            'Accept'           => 'application/json',
            'x-webhook-secret' => $webhook_secret
        ),
        'body'        => wp_json_encode($body)
    ));

    // 1. Check for transport error (e.g., your WP server is offline/blocked)
    if (is_wp_error($response)) {
        return new WP_Error('wp_transport_error', 'WordPress could not reach Supabase.', array('status' => 500));
    }

    // 2. Check the actual HTTP status code from Supabase
    $response_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);

    // If Supabase doesn't return 200 or 201, it failed.
    if ($response_code !== 200 && $response_code !== 201) {
        // Send the exact Supabase error code back to the frontend so we can debug it
        return new WP_Error(
            'supabase_rejected',
            'Supabase Error ' . $response_code . ': ' . $response_body,
            array('status' => $response_code)
        );
    }

    // Return success to the frontend ONLY if Supabase accepted it
    return rest_ensure_response(array('success' => true, 'message' => 'Successfully subscribed!'));
}`;
    const subscribeButton = `<div class="custom-subscribe-container">
    <form id="mailmain-subscribe-form" style="display: flex; gap: 12px; max-width: 750px;">
      <input
        type="email"
        id="mailmain-email"
        placeholder="Type your email..."
        required
        style="flex: 1; padding: 18px 24px; font-size: 16px; border: 1px solid #a3a3a3; border-radius: 0; background-color: #ffffff; color: #333333; outline: none;"
      />
      <button
        type="submit"
        style="padding: 18px 36px; background-color: ${config.buttonBackground}; color: ${config.buttonText}; font-size: 16px; font-weight: 400; border: none; border-radius: 0; cursor: pointer;"
      >
        Subscribe
      </button>
    </form>
    <div id="mailmain-subscribe-message" style="margin-top: 10px; font-size: 14px;"></div>
  </div>

  <script>
  document.getElementById('mailmain-subscribe-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const email = document.getElementById('mailmain-email').value;
    const messageDiv = document.getElementById('mailmain-subscribe-message');
    const submitButton = this.querySelector('button[type="submit"]');
    const originalBtnText = submitButton.innerText;

    // UI Loading state
    submitButton.innerText = 'Sending...';
    submitButton.disabled = true;
    messageDiv.innerText = '';
    messageDiv.style.color = 'inherit';

    try {
      const response = await fetch('/wp-json/mailmain/v1/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email })
      });

      const result = await response.json();

      if (response.ok) {
        messageDiv.innerText = 'Success! Check your inbox.';
        messageDiv.style.color = 'green';
        this.reset();
      } else {
        messageDiv.innerText = result.message || 'Something went wrong. Please try again.';
        messageDiv.style.color = 'red';
      }
    } catch (error) {
      messageDiv.innerText = 'Network error. Please try again.';
      messageDiv.style.color = 'red';
    } finally {
      submitButton.innerText = originalBtnText;
      submitButton.disabled = false;
    }
  });
  </script>`;
  return (
    <div className="space-y-5">
      <article className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold">WordPress</h3>
        <p className="mt-1 text-sm text-slate-500">
          Use PHP for subscriber sync. Use Uncanny Automator or another webhook
          tool for published posts.
        </p>
        <h4 className="mt-5 font-semibold">Subscriber sync via PHP</h4>
        <p className="mt-1 text-sm text-slate-500">
          Enter your webhook secret, then copy the generated REST API relay into
          WordPress using the safe setup instructions below.
        </p>
        <EndpointBox onCopy={onCopy} />
        <div className="mt-4 max-w-md">
          <ConfigField
            label="Webhook secret"
            type="password"
            value={config.secret}
            onChange={(secret) => setConfig((current) => ({ ...current, secret }))}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Code2 size={16} />
            Generated PHP
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onCopy(php)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              <Copy size={16} />
              Copy PHP
            </button>
            <button
              onClick={() => setInstructionsOpen((open) => !open)}
              aria-expanded={instructionsOpen}
              className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              {instructionsOpen ? "Hide instructions" : "Instructions"}
            </button>
          </div>
        </div>
        {instructionsOpen && <InstructionsPanel />}
        <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
          {php}
        </pre>
        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h4 className="font-semibold">Custom Subscribe Button</h4>
              <p className="mt-1 text-sm text-slate-500">
                Choose the button colors, then copy this code into a WordPress
                Custom HTML block.
              </p>
            </div>
            <button
              onClick={() => onCopy(subscribeButton)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              <Copy size={16} />
              Copy Subscribe Button
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <label className="text-sm font-medium text-slate-700">
              Button background
              <span className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={config.buttonBackground}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      buttonBackground: event.target.value,
                    }))
                  }
                  className="h-10 w-12 cursor-pointer rounded border border-slate-300 bg-white p-1"
                />
                <code>{config.buttonBackground}</code>
              </span>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Button text
              <span className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={config.buttonText}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      buttonText: event.target.value,
                    }))
                  }
                  className="h-10 w-12 cursor-pointer rounded border border-slate-300 bg-white p-1"
                />
                <code>{config.buttonText}</code>
              </span>
            </label>
          </div>
          <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
            {subscribeButton}
          </pre>
        </div>
      </article>
      <BlogPostInstructions onCopy={onCopy} />
    </div>
  );
}

function CustomInstructions({ onCopy }: { onCopy: (value: string) => void }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-semibold">Custom webhook source</h3>
      <p className="mt-1 text-sm text-slate-500">
        Use this for any RSS tool, custom app, or form service that can send
        JSON to MailMain.
      </p>
      <EndpointBox onCopy={onCopy} />
    </article>
  );
}
