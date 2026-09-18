import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { AppSettingsRow } from "../types/database";

const defaultSender = "Your Name <mail@your-domain.com>";

export default function SettingsManager() {
  const [settings, setSettings] = useState<AppSettingsRow | null>(null);
  const [rssFeedUrl, setRssFeedUrl] = useState("");
  const [resendFromEmail, setResendFromEmail] = useState(defaultSender);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("*")
      .eq("id", true)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setMessage(error.message);
          return;
        }
        setSettings(data);
        setRssFeedUrl(data.rss_feed_url ?? "");
        setResendFromEmail(data.resend_from_email ?? defaultSender);
      });
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    const payload = {
      id: true,
      rss_feed_url: rssFeedUrl.trim() || null,
      resend_from_email: resendFromEmail.trim() || defaultSender,
    };
    const { data, error } = await supabase
      .from("app_settings")
      .upsert(payload)
      .select("*")
      .single();
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setSettings(data);
    setMessage("Settings saved.");
  }

  return (
    <section className="mx-auto max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          Configure MailMain's public integration values and email sender
          identity.
        </p>
      </div>
      {message && (
        <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
          {message}
        </p>
      )}
      <div className="mt-6 grid gap-5">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="font-semibold">Blog and RSS</h3>
          <p className="mt-1 text-sm text-slate-500">
            Store the feed URL for your site and use it when configuring an
            RSS-to-webhook tool.
          </p>
          <label className="mt-4 block text-sm font-medium">
            RSS feed URL
            <input
              value={rssFeedUrl}
              onChange={(event) => setRssFeedUrl(event.target.value)}
              placeholder="https://your-domain.com/feed/"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal focus:border-teal-600 focus:outline-none"
            />
          </label>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="font-semibold">Resend sender</h3>
          <p className="mt-1 text-sm text-slate-500">
            This is the verified sender address used for manual campaigns and
            automations. The Resend API key remains a Supabase secret.
          </p>
          <label className="mt-4 block text-sm font-medium">
            From name and email
            <input
              value={resendFromEmail}
              onChange={(event) => setResendFromEmail(event.target.value)}
              placeholder="Your Name <mail@your-domain.com>"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal focus:border-teal-600 focus:outline-none"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving || (!settings && !resendFromEmail)}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </div>
    </section>
  );
}
