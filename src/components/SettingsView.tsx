import React, { useState, useEffect } from "react";
import { Key, Sparkles, Check, Moon, Sun, Monitor, Save, Cpu, Eye,
  LayoutTemplate, FileJson, FileText, Bell, BellOff, Globe, Cloud, HardDrive, Database, Settings, ShieldAlert, Activity } from "lucide-react";
import { isDummy } from "../firebase";
import {
  loadSettings, saveSettings, listenSettings,
  DEFAULT_SETTINGS, type AppSettings,
} from "../services/userSettings";
import { fetchMLStatus } from "../services/mlService";
import type { MLStatus } from "../types";
import MLCenter from "./MLCenter";
import DatasetManager from "./DatasetManager";

interface SettingsViewProps {
  user: any;
  hasApiKey: boolean;
}

export default function SettingsView({ user, hasApiKey }: SettingsViewProps) {
  const [mlStatus, setMlStatus] = useState<MLStatus | null>(null);
  const [pythonStatus, setPythonStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    fetchMLStatus().then(status => {
      setMlStatus(status);
      setPythonStatus(status ? "online" : "offline");
    }).catch(() => {
      setPythonStatus("offline");
    });
  }, []);
  const [activeTab, setActiveTab]     = useState<"general" | "ml" | "dataset">("general");
  const [theme, setTheme]             = useState(DEFAULT_SETTINGS.theme);
  const [model, setModel]             = useState(DEFAULT_SETTINGS.model);
  const [sensitivity, setSensitivity] = useState(DEFAULT_SETTINGS.sensitivity);
  const [saveHistory, setSaveHistory] = useState(DEFAULT_SETTINGS.saveHistory);
  const [autoUrlScan, setAutoUrlScan] = useState(DEFAULT_SETTINGS.autoUrlScan);
  const [enableOcr, setEnableOcr]     = useState(DEFAULT_SETTINGS.enableOcr);
  const [notifications, setNotifications] = useState(DEFAULT_SETTINGS.notifications);
  const [exportFormat, setExportFormat]   = useState(DEFAULT_SETTINGS.exportFormat);
  const [language, setLanguage]           = useState(DEFAULT_SETTINGS.language);
  const [defaultEngine, setDefaultEngine] = useState<"ai" | "ml" | "hybrid">(DEFAULT_SETTINGS.defaultEngine);
  const [saveIndicator, setSaveIndicator] = useState<"idle"|"saving"|"saved"|"offline">("idle");
  const [settingsSource, setSettingsSource] = useState<"firestore"|"local">("local");

  // ── Load from Firestore on mount + real-time sync ──────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    loadSettings(user.uid).then((s: AppSettings) => {
      apply(s);
      setSettingsSource(isDummy || !user?.uid ? "local" : "firestore");
    });
    const unsub = listenSettings(user.uid, (s: AppSettings) => {
      apply(s);
      setSettingsSource("firestore");
    });
    return () => unsub();
  }, [user?.uid]);

  function apply(s: AppSettings) {
    setTheme(s.theme); setModel(s.model); setSensitivity(s.sensitivity);
    setSaveHistory(s.saveHistory); setAutoUrlScan(s.autoUrlScan);
    setEnableOcr(s.enableOcr); setNotifications(s.notifications);
    setExportFormat(s.exportFormat); setLanguage(s.language);
    setDefaultEngine(s.defaultEngine || "hybrid");
    applyTheme(s.theme);
  }

  function applyTheme(t: string) {
    if (t === "light") document.documentElement.setAttribute("data-theme", "light");
    else if (t === "dark") document.documentElement.removeAttribute("data-theme");
    else {
      if (window.matchMedia?.("(prefers-color-scheme: light)").matches)
        document.documentElement.setAttribute("data-theme", "light");
      else document.documentElement.removeAttribute("data-theme");
    }
  }

  const handleSave = async () => {
    const s: AppSettings = { theme, model, sensitivity, saveHistory, autoUrlScan, enableOcr, notifications, exportFormat, language, defaultEngine };
    setSaveIndicator("saving");
    applyTheme(theme);
    window.dispatchEvent(new Event("karnakavach_settings_updated"));
    await saveSettings(user?.uid || "", s);
    setSaveIndicator(isDummy || !user?.uid ? "offline" : "saved");
    setTimeout(() => setSaveIndicator("idle"), 2500);
  };

  const handleReset = async () => {
    apply(DEFAULT_SETTINGS);
    await saveSettings(user?.uid || "", DEFAULT_SETTINGS);
    window.dispatchEvent(new Event("karnakavach_settings_updated"));
  };

  return (
    <div className="space-y-6 w-full max-w-6xl pb-10">

      {/* ── Header ── */}
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h2 className="font-display font-black text-xs uppercase tracking-widest text-[#7df4ff]">
            {activeTab === "general" ? "Operative Security Configuration" :
             activeTab === "ml" ? "Machine Learning Center" : "Machine Learning Dataset Manager"}
          </h2>
          <p className="font-sans text-xs text-on-surface-variant mt-1">
            {activeTab === "general" ? "Configure themes, intelligence models, privacy rules, and reporting standards." :
             activeTab === "ml" ? "Monitor, retrain, and manage your phishing detection model." :
             "Verify raw user feedbacks, filter duplicates and compile curated dataset."}
          </p>
          {activeTab === "general" && (
            <div className="flex items-center gap-1.5 mt-2">
              {settingsSource === "firestore"
                ? <><Cloud className="w-3 h-3 text-primary-fixed-dim" /><span className="text-[10px] text-primary-fixed-dim font-mono">Synced with Firestore</span></>
                : <><HardDrive className="w-3 h-3 text-outline-variant" /><span className="text-[10px] text-outline-variant font-mono">Local storage</span></>}
            </div>
          )}
        </div>
        {activeTab === "general" && (
          <div className="flex gap-3">
            <button onClick={handleReset}
              className="px-4 py-2 text-[10px] uppercase font-bold tracking-wider text-outline hover:text-on-surface transition-colors border border-outline-variant/30 rounded-lg bg-surface-container-low">
              Reset Defaults
            </button>
            <button onClick={handleSave} disabled={saveIndicator === "saving"}
              className="flex items-center gap-2 px-4 py-2 text-[10px] uppercase font-bold tracking-wider text-background rounded-lg bg-[#00dbe9] hover:bg-[#00c5d2] disabled:opacity-60 transition-colors">
              {saveIndicator === "saving"  ? <><span className="w-3.5 h-3.5 border-2 border-background border-t-transparent rounded-full animate-spin" /> Saving...</>
               : saveIndicator === "saved"   ? <><Check className="w-4 h-4" /> Saved to Cloud</>
               : saveIndicator === "offline" ? <><HardDrive className="w-4 h-4" /> Saved Locally</>
               : <><Save className="w-4 h-4" /> Apply Configuration</>}
            </button>
          </div>
        )}
      </div>

      {/* ── Sub-tabs Navigation ── */}
      <div className="flex border-b border-outline-variant/15 gap-2 select-none">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2 px-4 py-2.5 font-display text-[10px] uppercase tracking-wider font-extrabold border-b-2 transition-all cursor-pointer ${
            activeTab === "general"
              ? "border-[#00dbe9] text-[#00dbe9]"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Settings className="w-4 h-4" /> General Config
        </button>
        <button
          onClick={() => setActiveTab("ml")}
          className={`flex items-center gap-2 px-4 py-2.5 font-display text-[10px] uppercase tracking-wider font-extrabold border-b-2 transition-all cursor-pointer ${
            activeTab === "ml"
              ? "border-[#00dbe9] text-[#00dbe9]"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Cpu className="w-4 h-4" /> ML Center
        </button>
        <button
          onClick={() => setActiveTab("dataset")}
          className={`flex items-center gap-2 px-4 py-2.5 font-display text-[10px] uppercase tracking-wider font-extrabold border-b-2 transition-all cursor-pointer ${
            activeTab === "dataset"
              ? "border-[#00dbe9] text-[#00dbe9]"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Database className="w-4 h-4" /> Dataset Manager
        </button>
      </div>

      {/* ── Tab Contents ── */}
      <div className="pt-2">
        {activeTab === "general" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        {/* Appearance */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col gap-5 border border-neutral-800">
          <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-outline" /> Appearance & Interface
          </h3>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-neutral-300">Theme Preference</label>
              <div className="grid grid-cols-3 gap-2">
                {([["dark","Dark",<Moon className="w-5 h-5"/>],["light","Light",<Sun className="w-5 h-5"/>],["system","System",<Monitor className="w-5 h-5"/>]] as [string,string,React.ReactNode][]).map(([val,label,icon])=>(
                  <button key={val} onClick={() => setTheme(val)}
                    className={`flex flex-col items-center gap-2 p-3 border rounded-xl transition-all ${theme === val ? "bg-primary-fixed-dim/10 border-primary-fixed-dim text-primary-fixed-dim" : "bg-surface-container-low border-outline-variant/50 text-on-surface-variant hover:bg-surface-dim hover:text-on-surface"}`}>
                    {icon}<span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/10">
              <label className="text-xs font-bold text-on-surface">Language</label>
              <div className="flex gap-2">
                <Globe className="w-4 h-4 mt-2 text-outline" />
                <select value={language} onChange={e => setLanguage(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary-fixed-dim">
                  <option value="English">English (US)</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* AI Engine */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col gap-5 border border-outline-variant/30">
          <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-primary-fixed-dim flex items-center gap-2">
            <Cpu className="w-4 h-4" /> Cognitive Intelligence Engine
          </h3>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-on-surface">AI Provider / Model</label>
              <select value={model} onChange={e => setModel(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary-fixed-dim font-mono">
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/10">
              <label className="text-xs font-bold text-on-surface">Default Analysis Engine</label>
              <select value={defaultEngine} onChange={e => setDefaultEngine(e.target.value as any)}
                className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary-fixed-dim font-mono">
                <option value="hybrid">Hybrid Engine (Heuristic + ML + AI)</option>
                <option value="ai">Gemini AI Engine (Linguistics)</option>
                <option value="ml">Machine Learning Engine (Offline)</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/10">
              <label className="text-xs font-bold text-on-surface">Scan Sensitivity Level</label>
              <div className="grid grid-cols-3 gap-2">
                {["Low","Medium","High"].map(lvl => (
                  <button key={lvl} onClick={() => setSensitivity(lvl)}
                    className={`py-2 text-[10px] font-bold uppercase tracking-wider border rounded-lg transition-all ${sensitivity === lvl ? (lvl === "High" ? "bg-error/10 border-error/50 text-error" : lvl === "Medium" ? "bg-secondary-container/20 border-secondary/50 text-secondary" : "bg-emerald-500/10 border-emerald-500/50 text-emerald-400") : "bg-surface-container-low border-outline-variant/20 text-on-surface-variant hover:bg-surface-dim hover:text-on-surface"}`}>
                    {lvl}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-on-surface-variant mt-1 leading-relaxed">
                {sensitivity === "Low" ? "Permissive. Minimizes false positives." : sensitivity === "Medium" ? "Balanced semantic threat hunting." : "Aggressive heuristic blocking."}
              </p>
            </div>
          </div>
        </div>

        {/* Privacy */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col gap-5 border border-neutral-800">
          <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
            <Eye className="w-4 h-4 text-outline" /> Privacy & Automations
          </h3>
          <div className="space-y-4">
            {([
              ["Save Analysis History",    "Persist encrypted audit logs locally",             saveHistory,    () => setSaveHistory(!saveHistory)],
              ["Automatic URL Scanning",   "Pre-fetch and evaluate link destinations",         autoUrlScan,    () => setAutoUrlScan(!autoUrlScan)],
              ["Force OCR Processing",     "Extract payload from explicit screenshots",         enableOcr,      () => setEnableOcr(!enableOcr)],
            ] as [string,string,boolean,()=>void][]).map(([label, desc, val, toggle], i) => (
              <label key={label} className={`flex items-center justify-between cursor-pointer group${i>0?" pt-2 border-t border-outline-variant/10":""}`}>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-on-surface group-hover:text-primary-fixed-dim transition-colors">{label}</span>
                  <span className="text-[10px] text-on-surface-variant">{desc}</span>
                </div>
                <div className={`w-10 h-5 rounded-full p-1 border flex items-center transition-all ${val ? "bg-primary-fixed-dim/20 border-primary-fixed-dim/50" : "bg-surface-container border-outline-variant"}`}>
                  <div onClick={toggle} className={`w-3 h-3 rounded-full bg-white transition-all transform ${val ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Alerts & Reporting */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col gap-5 border border-outline-variant/50">
          <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
            <Bell className="w-4 h-4 text-outline" /> Alerts & Reporting
          </h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex gap-3 items-center">
                {notifications ? <Bell className="w-4 h-4 text-on-surface-variant" /> : <BellOff className="w-4 h-4 text-outline" />}
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-on-surface group-hover:text-primary-fixed-dim transition-colors">System Notifications</span>
                  <span className="text-[10px] text-on-surface-variant">Alerts for critical threats found</span>
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full p-1 border flex items-center transition-all ${notifications ? "bg-primary-fixed-dim/20 border-primary-fixed-dim/50" : "bg-surface-container border-outline-variant"}`}>
                <div onClick={() => { const n = !notifications; setNotifications(n); if (n && 'Notification' in window) Notification.requestPermission(); }}
                  className={`w-3 h-3 rounded-full bg-white transition-all transform ${notifications ? "translate-x-4" : "translate-x-0"}`} />
              </div>
            </label>
            <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/10">
              <label className="text-xs font-bold text-on-surface">Default Export Format</label>
              <div className="grid grid-cols-2 gap-2">
                {(["JSON","PDF"] as const).map(fmt => (
                  <button key={fmt} onClick={() => setExportFormat(fmt)}
                    className={`flex items-center justify-center gap-2 py-2 border rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${exportFormat === fmt ? "bg-primary-fixed-dim/10 border-primary-fixed-dim/40 text-primary-fixed-dim" : "bg-surface-container-low border-outline-variant/20 text-on-surface-variant hover:bg-surface-dim hover:text-on-surface"}`}>
                    {fmt === "JSON" ? <FileJson className="w-4 h-4" /> : <FileText className="w-4 h-4" />} {fmt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* System Diagnostics Dashboard */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col gap-5 border border-outline-variant/30 lg:col-span-2">
          <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-[#7df4ff] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#00dbe9]" /> System Diagnostics Dashboard
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Firebase Sync Check */}
            <div className="p-4 bg-surface-container-low/60 rounded-xl border border-outline-variant/20 flex flex-col justify-between gap-2">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-outline block mb-1">Firebase Sync Status</span>
                <span className="font-sans font-bold text-on-surface text-sm">Realtime Firestore</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded font-mono text-[9px] uppercase tracking-wider font-extrabold border w-fit ${isDummy ? "bg-error-container/10 border-error/20 text-error" : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"}`}>
                {isDummy ? "Offline Simulator" : "Online Sync Active"}
              </span>
            </div>
            {/* Gemini API Check */}
            <div className="p-4 bg-surface-container-low/60 rounded-xl border border-outline-variant/20 flex flex-col justify-between gap-2">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-outline block mb-1">Gemini AI Status</span>
                <span className="font-sans font-bold text-on-surface text-sm">Cognitive Gemini Core</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded font-mono text-[9px] uppercase tracking-wider font-extrabold border w-fit ${hasApiKey ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" : "bg-error-container/10 border-error/20 text-error"}`}>
                {hasApiKey ? "Active (Live)" : "Mock Fallback"}
              </span>
            </div>
            {/* Python Subprocess Check */}
            <div className="p-4 bg-surface-container-low/60 rounded-xl border border-outline-variant/20 flex flex-col justify-between gap-2">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-outline block mb-1">Python Backend Status</span>
                <span className="font-sans font-bold text-on-surface text-sm">Local Subprocess Gateway</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded font-mono text-[9px] uppercase tracking-wider font-extrabold border w-fit ${pythonStatus === "online" ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" : pythonStatus === "checking" ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-error-container/10 border-error/20 text-error"}`}>
                {pythonStatus === "online" ? "Online & Responsive" : pythonStatus === "checking" ? "Verifying link..." : "Offline / Unresponsive"}
              </span>
            </div>
          </div>
        </div>

        {/* ML Model Performance Metrics Summary Card */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col gap-5 border border-neutral-800 lg:col-span-1">
          <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
            <Cpu className="w-4 h-4 text-outline" /> Active ML Model Core Stats
          </h3>
          {mlStatus?.metrics ? (
            <div className="space-y-2.5">
              {[
                { label: "Model Version", val: mlStatus?.version_label || "v1.0.0" },
                { label: "Training Date", val: mlStatus?.last_trained ? new Date(mlStatus.last_trained).toLocaleDateString() : "Unknown" },
                { label: "Dataset Size", val: `${(mlStatus?.dataset_size || 0).toLocaleString()} samples` },
                { label: "Accuracy Score", val: `${((mlStatus?.metrics?.accuracy || 0) * 100).toFixed(1)}%` },
                { label: "Precision Rate", val: `${((mlStatus?.metrics?.precision || 0) * 100).toFixed(1)}%` },
                { label: "Recall Rate", val: `${((mlStatus?.metrics?.recall || 0) * 100).toFixed(1)}%` },
                { label: "F1 Performance", val: `${((mlStatus?.metrics?.f1_score || 0) * 100).toFixed(1)}%` },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between items-center text-xs border-b border-outline-variant/10 pb-1.5 last:border-0 last:pb-0 font-sans">
                  <span className="text-on-surface-variant">{label}</span>
                  <span className="font-mono font-bold text-on-surface">{val}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-outline-variant font-mono py-4 text-center">
              No active model metrics available. Check retraining status under MLCenter tab.
            </p>
          )}
        </div>

          </div>
        )}

        {activeTab === "ml" && user?.uid && (
          <div className="mt-2">
            <MLCenter userId={user.uid} />
          </div>
        )}

        {activeTab === "dataset" && (
          <div className="mt-2">
            <DatasetManager />
          </div>
        )}
      </div>

    </div>
  );
}
