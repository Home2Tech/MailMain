import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { SubscriberListRow } from "../types/database";

export default function ListManager() {
  const [lists, setLists] = useState<SubscriberListRow[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = async () => { const { data, error } = await supabase.from("subscriber_lists").select("*").order("name"); if (error) setError(error.message); else setLists(data ?? []); };
  useEffect(() => { load(); }, []);
  async function add() { if (!name.trim()) return; const { error } = await supabase.from("subscriber_lists").insert({ name: name.trim() }); if (error) setError(error.message); else { setName(""); load(); } }
  async function remove(list: SubscriberListRow) { if (list.name === "Subscribers" || !window.confirm(`Delete ${list.name}?`)) return; const { error } = await supabase.from("subscriber_lists").delete().eq("id", list.id); if (error) setError(error.message); else load(); }
  return <section className="mx-auto max-w-3xl"><h2 className="text-xl font-semibold">Lists</h2><p className="mt-1 text-sm text-slate-500">Organize subscribers for targeted campaigns.</p>{error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-6 flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="New list name" className="flex-1 rounded-md border border-slate-300 px-3 py-2"/><button onClick={add} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><Plus size={16}/>Add list</button></div><div className="mt-5 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">{lists.map((list) => <div key={list.id} className="flex items-center justify-between p-4"><span className="font-medium">{list.name}</span><button disabled={list.name === "Subscribers"} onClick={() => remove(list)} title="Delete list" className="p-2 text-slate-500 disabled:opacity-20"><Trash2 size={17}/></button></div>)}</div></section>;
}
