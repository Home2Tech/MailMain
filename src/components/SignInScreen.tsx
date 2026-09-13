import { useState } from "react";
import { LogIn, Mail, LockKeyhole } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) setError(signInError.message);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-5 text-slate-900">
      <form onSubmit={signIn} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-7 shadow-sm">
        <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-wide text-teal-700">MailMain</p><h1 className="mt-1 text-2xl font-semibold">Sign in</h1><p className="mt-2 text-sm text-slate-500">Use the administrator account created in Supabase.</p></div>
        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <label className="block text-sm font-medium">Email<div className="relative mt-1"><Mail size={16} className="absolute left-3 top-3 text-slate-400" /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 font-normal focus:border-teal-600 focus:outline-none" /></div></label>
        <label className="mt-4 block text-sm font-medium">Password<div className="relative mt-1"><LockKeyhole size={16} className="absolute left-3 top-3 text-slate-400" /><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 font-normal focus:border-teal-600 focus:outline-none" /></div></label>
        <button disabled={submitting} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"><LogIn size={16} />{submitting ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}
