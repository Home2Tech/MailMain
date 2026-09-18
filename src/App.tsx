import { useEffect, useState } from "react";
import { HashRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { Cable, List, LogOut, Mail, Menu, Settings, Users, Workflow, X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import TemplateBuilder from "./pages/TemplateBuilder";
import WorkflowManager from "./pages/WorkflowManager";
import ListManager from "./pages/ListManager";
import SubscriberManager from "./pages/SubscriberManager";
import SettingsManager from "./pages/SettingsManager";
import IntegrationsManager from "./pages/IntegrationsManager";
import SignInScreen from "./components/SignInScreen";
import { supabase } from "./lib/supabaseClient";
import "./index.css";

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const menuItems = [
    { to: "/templates", label: "Templates", icon: Mail },
    { to: "/lists", label: "Lists", icon: List },
    { to: "/workflows", label: "Automations", icon: Workflow },
    { to: "/subscribers", label: "Subscribers", icon: Users },
    { to: "/integrations", label: "Integrations", icon: Cable },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loadingSession) return <main className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500">Loading MailMain...</main>;
  if (!session) return <SignInScreen />;

  return (
    <HashRouter>
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
        <header className="relative z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
          <h1 className="flex items-center gap-2 text-base font-semibold"><img src="/mailmain-logo.png" alt="" className="h-9 w-9 rounded object-cover object-center" />MailMain</h1>
          <button onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="app-menu" className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700"><Menu size={17} />Menu</button>
          {menuOpen && <nav id="app-menu" className="absolute right-5 top-14 grid w-52 grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
            <button onClick={() => setMenuOpen(false)} title="Close menu" aria-label="Close menu" className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-white"><X size={14} /></button>
            {menuItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex min-h-20 flex-col items-center justify-center gap-2 rounded-md text-xs font-medium ${isActive ? "bg-slate-100 text-slate-900" : "hover:bg-slate-50"}`}><Icon size={25} strokeWidth={1.8} />{label}</NavLink>)}
            <button onClick={() => { setMenuOpen(false); supabase.auth.signOut(); }} className="col-span-2 mt-1 inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 py-2 text-xs font-medium hover:bg-slate-50"><LogOut size={15} />Sign out</button>
          </nav>}
        </header>

        <main className="min-h-0 flex-1 p-4 sm:p-5 lg:p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/templates" replace />} />
            <Route path="/templates" element={<TemplateBuilder />} />
            <Route path="/workflows" element={<WorkflowManager />} />
            <Route path="/lists" element={<ListManager />} />
            <Route path="/subscribers" element={<SubscriberManager />} />
            <Route path="/integrations" element={<IntegrationsManager />} />
            <Route path="/settings" element={<SettingsManager />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
