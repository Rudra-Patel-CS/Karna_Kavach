import React, { useState, useEffect, useRef } from "react";
import { Shield, Key, Sparkles, User, Database, Check, AlertTriangle, Moon, Sun, Monitor, Save, RefreshCw, Cpu, Eye, EyeOff, LayoutTemplate, FileJson, FileText, Bell, BellOff, Globe, Brain, Download, BarChart3, RotateCcw, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { isDummy } from "../firebase";
import { MLStatus } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface SettingsViewProps {
  user: any;
  hasApiKey: boolean;
}

export default function SettingsView({ user, hasApiKey }: SettingsViewProps) {
  const [theme, setTheme] = useState("dark");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [sensitivity, setSensitivity] = useState("Medium");
  const [saveHistory, setSaveHistory] = useState(true);
  const [autoUrlScan, setAutoUrlScan] = useState(true);
  const [enableOcr, setEnableOcr] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [exportFormat, setExportFormat] = useState("JSON");
  const [language, setLanguage] = useState("English");
  
  const [saveIndicator, setSaveIndicator] = useState(false);

  // ── ML Management State ──────────────────────────────────────────
  const [mlStatus, setMlStatus] = useState<MLStatus | null>(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [retrainLogs, setRetrainLogs] = useState<string[]>([]);
  const [retrainStatus, setRetrainStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [retrainMetrics, setRetrainMetrics] = useState<any>(null);
  const [autoRetrainThreshold, setAutoRetrainThreshold] = useState<number | null>(null);
  const [showFeedbackStats, setShowFeedbackStats] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchMlStatus = async () => {
    setMlLoading(true);
    try {
      const res = await fetch("/api/ml-status");
      const data = await res.json();
      setMlStatus(data);
      setAutoRetrainThreshold(data.auto_retrain_threshold ?? null);
    } catch {
      // silently fail — not critical
    } finally {
      setMlLoading(false);
    }
  };

  useEffect(() => {
    fetchMlStatus();
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [retrainLogs]);

  const handleRetrain = async () => {
    setRetrainStatus("running");
    setRetrainLogs(["[START] Initiating retraining pipeline..."]);
    setRetrainMetrics(null);

    try {
      const res = await fetch("/api/ml-retrain", { method: "POST" });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const event = JSON.parse(line.replace("data: ", ""));
            if (event.type === "log") {
              setRetrainLogs(prev => [...prev, event.message]);
            } else if (event.type === "complete") {
              setRetrainStatus("done");
              setRetrainMetrics(event.metrics);
              setRetrainLogs(prev => [...prev, `[DONE] Training complete! Model is now v${event.metrics?.version}.`]);
              fetchMlStatus();
            } else if (event.type === "error") {
              setRetrainStatus("error");
              setRetrainLogs(prev => [...prev, `[ERROR] ${event.error}`]);
            }
          } catch { /* ignore parse errors on partial chunks */ }
        }
      }
    } catch (err: any) {
      setRetrainStatus("error");
      setRetrainLogs(prev => [...prev, `[ERROR] ${err.message}`]);
    }
  };

  const handleSaveAutoRetrain = async (threshold: number | null) => {
    setAutoRetrainThreshold(threshold);
    try {
      await fetch("/api/ml-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoRetrainThreshold: threshold }),
      });
    } catch { /* non-critical */ }
  };

  const handleDownloadFeedback = () => {
    window.open("/api/ml-feedback-download", "_blank");
  };
  // ── ML Management State END ──────────────────────────────────────

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("karnakavach_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTheme(parsed.theme || "dark");
        setModel(parsed.model || "gemini-2.5-flash");
        setSensitivity(parsed.sensitivity || "Medium");
        setSaveHistory(parsed.saveHistory ?? true);
        setAutoUrlScan(parsed.autoUrlScan ?? true);
        setEnableOcr(parsed.enableOcr ?? true);
        setNotifications(parsed.notifications ?? true);
        setExportFormat(parsed.exportFormat || "JSON");
        setLanguage(parsed.language || "English");
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  const handleSaveSettings = () => {
    const settings = { theme, model, sensitivity, saveHistory, autoUrlScan, enableOcr, notifications, exportFormat, language };
    localStorage.setItem("karnakavach_settings", JSON.stringify(settings));
    window.dispatchEvent(new Event("karnakavach_settings_updated"));
    setSaveIndicator(true);
    setTimeout(() => setSaveIndicator(false), 2000);
  };

  const handleResetDefaults = () => {
    setTheme("dark");
    setModel("gemini-1.5-pro");
    setSensitivity("Medium");
    setSaveHistory(true);
    setAutoUrlScan(true);
    setEnableOcr(true);
    setNotifications(true);
    setExportFormat("JSON");
    setLanguage("English");
    localStorage.removeItem("karnakavach_settings");
    window.dispatchEvent(new Event("karnakavach_settings_updated"));
  };

  return (
    <div className="space-y-6 w-full max-w-6xl pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-display font-black text-xs uppercase tracking-widest text-[#7df4ff]">
            Operative Security Configuration
          </h2>
          <p className="font-sans text-xs text-on-surface-variant mt-1">
            Configure system themes, intelligence models, privacy rules, and reporting standards.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleResetDefaults}
            className="px-4 py-2 text-[10px] uppercase font-bold tracking-wider text-outline hover:text-on-surface transition-colors border border-outline-variant/30 rounded-lg bg-surface-container-low"
          >
            Reset Defaults
          </button>
          <button 
            onClick={handleSaveSettings}
            className="flex items-center gap-2 px-4 py-2 text-[10px] uppercase font-bold tracking-wider text-background transition-colors rounded-lg bg-[#00dbe9] hover:bg-[#00c5d2]"
          >
            {saveIndicator ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saveIndicator ? "Saved" : "Apply Configuration"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* Appearance & Themes */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col gap-5 border border-neutral-800">
          <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-outline" />
            Appearance & Interface
          </h3>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-neutral-300">Theme Preference</label>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setTheme("dark")} className={`flex flex-col items-center gap-2 p-3 border rounded-xl transition-all ${theme === "dark" ? "bg-primary-fixed-dim/10 border-primary-fixed-dim text-primary-fixed-dim" : "bg-surface-container-low border-outline-variant/50 text-on-surface-variant hover:bg-surface-dim hover:text-on-surface"}`}>
                  <Moon className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Dark</span>
                </button>
                <button onClick={() => setTheme("light")} className={`flex flex-col items-center gap-2 p-3 border rounded-xl transition-all ${theme === "light" ? "bg-primary-fixed-dim/10 border-primary-fixed-dim text-primary-fixed-dim" : "bg-surface-container-low border-outline-variant/50 text-on-surface-variant hover:bg-surface-dim hover:text-on-surface"}`}>
                  <Sun className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Light</span>
                </button>
                <button onClick={() => setTheme("system")} className={`flex flex-col items-center gap-2 p-3 border rounded-xl transition-all ${theme === "system" ? "bg-primary-fixed-dim/10 border-primary-fixed-dim text-primary-fixed-dim" : "bg-surface-container-low border-outline-variant/50 text-on-surface-variant hover:bg-surface-dim hover:text-on-surface"}`}>
                  <Monitor className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">System</span>
                </button>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/10">
              <label className="text-xs font-bold text-on-surface">Language</label>
              <div className="flex gap-2">
                <Globe className="w-4 h-4 mt-2 text-outline" />
                <select 
                  value={language} 
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary-fixed-dim"
                >
                  <option value="English">English (US)</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* AI & Detection Settings */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col gap-5 border border-outline-variant/30">
          <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-primary-fixed-dim flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary-fixed-dim" />
            Cognitive Intelligence Engine
          </h3>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-on-surface">AI Provider / Model</label>
              <select 
                value={model} 
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary-fixed-dim font-mono"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              </select>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/10">
              <label className="text-xs font-bold text-on-surface">Scan Sensitivity Level</label>
              <div className="grid grid-cols-3 gap-2">
                {["Low", "Medium", "High"].map(level => (
                  <button 
                    key={level}
                    onClick={() => setSensitivity(level)}
                    className={`py-2 text-[10px] font-bold uppercase tracking-wider border rounded-lg transition-all ${sensitivity === level ? (level === "High" ? "bg-error/10 border-error/50 text-error" : level === "Medium" ? "bg-secondary-container/20 border-secondary/50 text-secondary" : "bg-emerald-500/10 border-emerald-500/50 text-emerald-400") : "bg-surface-container-low border-outline-variant/20 text-on-surface-variant hover:bg-surface-dim hover:text-on-surface"}`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-on-surface-variant mt-1 leading-relaxed">
                {sensitivity === "Low" ? "Permissive rule-matching. Minimizes false positives." : sensitivity === "Medium" ? "Balanced semantic threat hunting." : "Aggressive heuristic and zero-day suspicion blocking."}
              </p>
            </div>
          </div>
        </div>

        {/* Privacy & Automations */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col gap-5 border border-neutral-800">
          <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
            <Eye className="w-4 h-4 text-outline" />
            Privacy & Automations
          </h3>
          <div className="space-y-4">
            
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-on-surface group-hover:text-primary-fixed-dim transition-colors">Save Analysis History</span>
                <span className="text-[10px] text-on-surface-variant">Persist encrypted audit logs locally</span>
              </div>
              <div className={`w-10 h-5 rounded-full p-1 border flex items-center transition-all ${saveHistory ? "bg-primary-fixed-dim/20 border-primary-fixed-dim/50" : "bg-surface-container border-outline-variant"}`}>
                <div onClick={() => setSaveHistory(!saveHistory)} className={`w-3 h-3 rounded-full bg-white transition-all transform ${saveHistory ? "translate-x-4" : "translate-x-0"}`} />
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer group pt-2 border-t border-outline-variant/10">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-on-surface group-hover:text-primary-fixed-dim transition-colors">Automatic URL Scanning</span>
                <span className="text-[10px] text-on-surface-variant">Pre-fetch and evaluate link destinations</span>
              </div>
              <div className={`w-10 h-5 rounded-full p-1 border flex items-center transition-all ${autoUrlScan ? "bg-primary-fixed-dim/20 border-primary-fixed-dim/50" : "bg-surface-container border-outline-variant"}`}>
                <div onClick={() => setAutoUrlScan(!autoUrlScan)} className={`w-3 h-3 rounded-full bg-white transition-all transform ${autoUrlScan ? "translate-x-4" : "translate-x-0"}`} />
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer group pt-2 border-t border-outline-variant/10">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-on-surface group-hover:text-primary-fixed-dim transition-colors">Force OCR Processing</span>
                <span className="text-[10px] text-on-surface-variant">Extract payload from explicit screenshots</span>
              </div>
              <div className={`w-10 h-5 rounded-full p-1 border flex items-center transition-all ${enableOcr ? "bg-primary-fixed-dim/20 border-primary-fixed-dim/50" : "bg-surface-container border-outline-variant"}`}>
                <div onClick={() => setEnableOcr(!enableOcr)} className={`w-3 h-3 rounded-full bg-white transition-all transform ${enableOcr ? "translate-x-4" : "translate-x-0"}`} />
              </div>
            </label>

          </div>
        </div>

        {/* Global Notifications & Exports */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col gap-5 border border-outline-variant/50">
          <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
            <Bell className="w-4 h-4 text-outline" />
            Alerts & Reporting
          </h3>
          <div className="space-y-4">
            
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex gap-3 items-center">
                {notifications ? <Bell className="w-4 h-4 text-on-surface-variant group-hover:text-on-surface" /> : <BellOff className="w-4 h-4 text-outline" />}
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-on-surface group-hover:text-primary-fixed-dim transition-colors">System Notifications</span>
                  <span className="text-[10px] text-on-surface-variant">Alerts for critical threats found</span>
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full p-1 border flex items-center transition-all ${notifications ? "bg-primary-fixed-dim/20 border-primary-fixed-dim/50" : "bg-surface-container border-outline-variant"}`}>
                <div onClick={() => {
                  const newState = !notifications;
                  setNotifications(newState);
                  if (newState && 'Notification' in window) {
                    Notification.requestPermission();
                  }
                }} className={`w-3 h-3 rounded-full bg-white transition-all transform ${notifications ? "translate-x-4" : "translate-x-0"}`} />
              </div>
            </label>

            <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/10">
              <label className="text-xs font-bold text-on-surface">Default Export Format</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setExportFormat("JSON")}
                  className={`flex items-center justify-center gap-2 py-2 border rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${exportFormat === "JSON" ? "bg-primary-fixed-dim/10 border-primary-fixed-dim/40 text-primary-fixed-dim" : "bg-surface-container-low border-outline-variant/20 text-on-surface-variant hover:bg-surface-dim hover:text-on-surface"}`}
                >
                  <FileJson className="w-4 h-4" /> JSON
                </button>
                <button 
                  onClick={() => setExportFormat("PDF")}
                  className={`flex items-center justify-center gap-2 py-2 border rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${exportFormat === "PDF" ? "bg-primary-fixed-dim/10 border-primary-fixed-dim/40 text-primary-fixed-dim" : "bg-surface-container-low border-outline-variant/20 text-on-surface-variant hover:bg-surface-dim hover:text-on-surface"}`}
                >
                  <FileText className="w-4 h-4" /> PDF
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* API Credentials */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col gap-5 border border-neutral-800 lg:col-span-2">
          <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-[#7df4ff] flex items-center gap-2">
            <Key className="w-4 h-4 text-[#00dbe9]" />
            Core Credentials Integration
          </h3>

          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-3">
              <div className="p-4 bg-surface-container-low/60 rounded-xl border border-outline-variant/20 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="font-sans font-bold text-on-surface text-sm">Gemini Live Analysis Engine</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-wider font-extrabold border ${
                    hasApiKey 
                      ? "bg-primary-container/10 border-primary-fixed-dim/20 text-primary-fixed-dim shadow-[0_0_8px_rgba(0,219,233,0.1)]" 
                      : "bg-error-container/10 border-error/20 text-error"
                  }`}>
                    {hasApiKey ? "ACTIVE COGNITIVE" : "SIMULATOR FALLBACK"}
                  </span>
                </div>
                <p className="text-outline text-[11px] leading-relaxed mt-1">
                  {hasApiKey 
                    ? "Karna_Kavach Live Scan is fully operational. Email payloads are processed securely on the server using advanced cognitive AI."
                    : "Scanning currently running in simulated offline sandbox mode. To complete real scans, configure your Gemini API Key in the server .env or AI Studio Secrets."
                  }
                </p>
              </div>

              <div className="p-4 bg-surface-container-lowest border border-outline-variant/15 rounded-xl flex gap-3 text-[11px]">
                <Sparkles className="w-5 h-5 text-[#00dbe9] shrink-0 mt-0.5" />
                <div className="text-on-surface-variant space-y-1">
                  <strong className="text-on-surface block">Dynamic Secret Management Enforcer:</strong>
                  Karna_Kavach keys are managed securely by the platform environment. 
                  Never paste API secrets directly into raw code or input boxes to prevent data exfiltration.
                </div>
              </div>
            </div>

            <div className="md:w-64 space-y-3 font-sans text-xs">
              <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                <span className="text-outline uppercase tracking-wider text-[10px]">Operative ID</span>
                <span className="text-on-surface font-mono font-bold select-all truncate max-w-[120px]">{user?.uid || "auth_guest"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                <span className="text-outline uppercase tracking-wider text-[10px]">Clearance</span>
                <span className="text-[#00dbe9] font-display font-black text-[10px] uppercase tracking-widest">SysAdmin</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                <span className="text-outline uppercase tracking-wider text-[10px]">Auth Target</span>
                <span className="text-on-surface truncate max-w-[140px] font-medium">{user?.email || "anonymous"}</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ── ML MANAGEMENT SECTION ──────────────────────────────────────── */}
      <div className="mt-2">
        <div className="flex items-center gap-3 mb-6">
          <Brain className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="font-display font-black text-xs uppercase tracking-widest text-indigo-400">
              Machine Learning Management
            </h2>
            <p className="font-sans text-xs text-on-surface-variant mt-0.5">
              Manage model versions, review feedback data, and retrain with new samples.
            </p>
          </div>
          <button
            onClick={fetchMlStatus}
            disabled={mlLoading}
            className="ml-auto p-2 rounded-lg border border-outline-variant/30 hover:border-indigo-500/40 text-outline-variant hover:text-indigo-400 transition-all disabled:opacity-50"
            title="Refresh ML status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${mlLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

          {/* Model Status Card */}
          <div className="glass-panel p-6 rounded-3xl border border-indigo-500/20 flex flex-col gap-4">
            <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-indigo-400 flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Active Model Status
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-on-surface-variant">Model Version</span>
                <span className="font-mono font-black text-indigo-400 text-sm bg-indigo-500/15 px-3 py-0.5 rounded-full border border-indigo-500/30">
                  {mlStatus ? mlStatus.version_label : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-outline-variant/10">
                <span className="text-xs text-on-surface-variant">Training Dataset</span>
                <span className="font-mono text-xs text-on-surface font-bold">{mlStatus?.dataset_size ?? "—"} samples</span>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-outline-variant/10">
                <span className="text-xs text-on-surface-variant">Feedback Collected</span>
                <span className="font-mono text-xs text-on-surface font-bold">{mlStatus?.feedback_size ?? "—"} samples</span>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-outline-variant/10">
                <span className="text-xs text-on-surface-variant">Last Retrained</span>
                <span className="font-mono text-xs text-on-surface font-bold truncate max-w-[130px]">
                  {mlStatus?.last_trained
                    ? new Date(mlStatus.last_trained).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : "Never"}
                </span>
              </div>
              {mlStatus?.metrics && (
                <div className="flex justify-between items-center py-2 border-t border-outline-variant/10">
                  <span className="text-xs text-on-surface-variant">Accuracy</span>
                  <span className={`font-mono text-xs font-black ${mlStatus.metrics.accuracy >= 0.9 ? "text-emerald-400" : mlStatus.metrics.accuracy >= 0.75 ? "text-yellow-400" : "text-rose-400"}`}>
                    {(mlStatus.metrics.accuracy * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Feedback Statistics Card */}
          <div className="glass-panel p-6 rounded-3xl border border-indigo-500/20 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Feedback Statistics
              </h3>
              <button
                onClick={() => setShowFeedbackStats(s => !s)}
                className="text-outline-variant hover:text-indigo-400 transition-colors"
              >
                {showFeedbackStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {mlStatus?.feedback_stats && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-container-low rounded-xl p-3 text-center border border-outline-variant/20">
                    <div className="text-2xl font-display font-black text-indigo-400">{mlStatus.feedback_stats.total}</div>
                    <div className="text-[9px] uppercase tracking-wider text-outline-variant font-bold mt-1">Total Feedback</div>
                  </div>
                  <div className="bg-surface-container-low rounded-xl p-3 text-center border border-outline-variant/20">
                    <div className="text-2xl font-display font-black text-amber-400">{mlStatus.feedback_stats.corrections}</div>
                    <div className="text-[9px] uppercase tracking-wider text-outline-variant font-bold mt-1">Corrections</div>
                  </div>
                </div>

                <AnimatePresence>
                  {showFeedbackStats && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      <div className="flex justify-between items-center py-1.5 border-t border-outline-variant/10">
                        <span className="text-xs text-on-surface-variant">Confirmed Correct</span>
                        <span className="font-mono text-xs text-emerald-400 font-bold">{mlStatus.feedback_stats.correct}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-t border-outline-variant/10">
                        <span className="text-xs text-on-surface-variant">Labeled Phishing</span>
                        <span className="font-mono text-xs text-rose-400 font-bold">{mlStatus.feedback_stats.phishing}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-t border-outline-variant/10">
                        <span className="text-xs text-on-surface-variant">Labeled Legitimate</span>
                        <span className="font-mono text-xs text-emerald-400 font-bold">{mlStatus.feedback_stats.legitimate}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {mlStatus.feedback_stats.total === 0 && (
                  <p className="text-[11px] text-outline-variant text-center py-2">
                    No feedback collected yet. Analyze emails in ML mode and use 👍 / 👎 to contribute.
                  </p>
                )}
              </div>
            )}

            <div className="mt-auto pt-3 border-t border-outline-variant/10">
              <button
                onClick={handleDownloadFeedback}
                disabled={!mlStatus?.feedback_size}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-indigo-500/30 text-[10px] uppercase font-bold tracking-wider text-indigo-400 hover:bg-indigo-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                Download Feedback CSV
              </button>
            </div>
          </div>

          {/* Auto Retrain Settings */}
          <div className="glass-panel p-6 rounded-3xl border border-indigo-500/20 flex flex-col gap-4">
            <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-indigo-400 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Automatic Retraining
            </h3>

            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Automatically trigger model retraining when feedback reaches a threshold. OFF by default.
            </p>

            <div className="space-y-2">
              {[null, 50, 100, 500].map((threshold) => (
                <button
                  key={String(threshold)}
                  onClick={() => handleSaveAutoRetrain(threshold)}
                  className={`w-full py-2.5 px-4 rounded-lg border text-xs font-bold uppercase tracking-wider text-left flex items-center justify-between transition-all ${
                    autoRetrainThreshold === threshold
                      ? "border-indigo-500 bg-indigo-500/15 text-indigo-300"
                      : "border-outline-variant/20 text-on-surface-variant hover:border-indigo-500/30 hover:text-on-surface"
                  }`}
                >
                  <span>{threshold === null ? "Off (Manual only)" : `Every ${threshold} feedback samples`}</span>
                  {autoRetrainThreshold === threshold && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </button>
              ))}
            </div>

            {mlStatus?.should_auto_retrain && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
                <Zap className="w-3.5 h-3.5 shrink-0" />
                Threshold reached — retrain recommended!
              </div>
            )}
          </div>

          {/* Retrain Model — full width */}
          <div className="glass-panel p-6 rounded-3xl border border-indigo-500/25 xl:col-span-3 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Retrain Model
                </h3>
                <p className="text-[11px] text-on-surface-variant mt-1">
                  Merges original dataset + feedback, rebalances classes, trains a new versioned model, and saves metrics.
                </p>
              </div>

              <button
                onClick={handleRetrain}
                disabled={retrainStatus === "running"}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-display font-black text-xs tracking-widest uppercase transition-all shrink-0 ${
                  retrainStatus === "running"
                    ? "bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 cursor-wait"
                    : retrainStatus === "done"
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                    : retrainStatus === "error"
                    ? "bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25"
                    : "bg-indigo-500 hover:bg-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                }`}
              >
                {retrainStatus === "running" ? (
                  <><span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> Retraining...</>
                ) : retrainStatus === "done" ? (
                  <><Check className="w-4 h-4" /> Done!</>
                ) : retrainStatus === "error" ? (
                  <><AlertTriangle className="w-4 h-4" /> Retry</>
                ) : (
                  <><RotateCcw className="w-4 h-4" /> Retrain Model</>
                )}
              </button>
            </div>

            {/* Live training log */}
            {retrainLogs.length > 0 && (
              <div className="bg-black/40 rounded-xl border border-outline-variant/20 p-4 font-mono text-[11px] text-emerald-400 max-h-48 overflow-y-auto space-y-0.5">
                {retrainLogs.map((log, i) => (
                  <div key={i} className={`leading-relaxed ${log.includes("[ERROR]") ? "text-rose-400" : log.includes("[DONE]") ? "text-emerald-300 font-bold" : "text-emerald-500/80"}`}>
                    {log}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}

            {/* Post-retrain metrics dashboard */}
            {retrainMetrics && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 pt-2"
              >
                {[
                  { label: "Version", value: `v${retrainMetrics.version}`, color: "text-indigo-400" },
                  { label: "Total Samples", value: retrainMetrics.dataset_size, color: "text-on-surface" },
                  { label: "Legitimate", value: retrainMetrics.n_legitimate, color: "text-emerald-400" },
                  { label: "Phishing", value: retrainMetrics.n_phishing, color: "text-rose-400" },
                  { label: "Accuracy", value: `${(retrainMetrics.accuracy * 100).toFixed(1)}%`, color: retrainMetrics.accuracy >= 0.9 ? "text-emerald-400" : "text-yellow-400" },
                  { label: "Precision", value: `${(retrainMetrics.precision * 100).toFixed(1)}%`, color: "text-primary-fixed-dim" },
                  { label: "Recall", value: `${(retrainMetrics.recall * 100).toFixed(1)}%`, color: "text-primary-fixed-dim" },
                  { label: "F1-Score", value: `${(retrainMetrics.f1_score * 100).toFixed(1)}%`, color: "text-primary-fixed-dim" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-surface-container-low rounded-xl p-3 text-center border border-outline-variant/15">
                    <div className={`font-display font-black text-lg ${color}`}>{value}</div>
                    <div className="text-[9px] uppercase tracking-wider text-outline-variant font-bold mt-0.5">{label}</div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Confusion matrix */}
            {retrainMetrics?.confusion_matrix && (
              <div className="flex items-start gap-6 pt-2 border-t border-outline-variant/10">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-outline-variant font-bold mb-2">Confusion Matrix</p>
                  <div className="grid grid-cols-2 gap-1 w-fit font-mono text-xs">
                    <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded px-3 py-2 text-center">
                      <div className="font-black text-lg">{retrainMetrics.confusion_matrix[0][0]}</div>
                      <div className="text-[9px] uppercase tracking-wider opacity-70">True Legit</div>
                    </div>
                    <div className="bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded px-3 py-2 text-center">
                      <div className="font-black text-lg">{retrainMetrics.confusion_matrix[0][1]}</div>
                      <div className="text-[9px] uppercase tracking-wider opacity-70">False Phish</div>
                    </div>
                    <div className="bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded px-3 py-2 text-center">
                      <div className="font-black text-lg">{retrainMetrics.confusion_matrix[1][0]}</div>
                      <div className="text-[9px] uppercase tracking-wider opacity-70">Missed Phish</div>
                    </div>
                    <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded px-3 py-2 text-center">
                      <div className="font-black text-lg">{retrainMetrics.confusion_matrix[1][1]}</div>
                      <div className="text-[9px] uppercase tracking-wider opacity-70">True Phish</div>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-on-surface-variant space-y-1.5 mt-1">
                  <p><span className="text-emerald-400 font-bold">True Legit</span> — correctly identified as safe</p>
                  <p><span className="text-rose-400 font-bold">False Phish</span> — safe emails wrongly flagged</p>
                  <p><span className="text-amber-400 font-bold">Missed Phish</span> — phishing emails not caught</p>
                  <p><span className="text-emerald-400 font-bold">True Phish</span> — correctly caught phishing</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
      {/* ── ML MANAGEMENT SECTION END ─────────────────────────────────── */}

    </div>
  );
}

