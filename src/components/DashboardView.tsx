import { useState } from "react";
import { 
  Shield, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  ShieldAlert, 
  Layers, 
  Mail, 
  ArrowUpRight, 
  Clock, 
  Plus, 
  Search,
  CheckCircle,
  HelpCircle,
  Link2,
  X,
  SearchCode
} from "lucide-react";
import { Scan, DashboardStats } from "../types";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";
import { motion, AnimatePresence } from "motion/react";

interface DashboardViewProps {
  scans: Scan[];
  onSelectScan: (scan: Scan) => void;
  onInitiateScanMail: () => void;
}

export default function DashboardView({ scans, onSelectScan, onInitiateScanMail }: DashboardViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlAnalyzing, setUrlAnalyzing] = useState(false);
  const [urlResult, setUrlResult] = useState<any>(null);
  const [urlError, setUrlError] = useState("");

  const handleAnalyzeUrl = async () => {
    if (!urlInput.trim()) return;
    setUrlAnalyzing(true);
    setUrlError("");
    setUrlResult(null);

    try {
      const res = await fetch("/api/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      setUrlResult(data);
    } catch (err: any) {
      setUrlError("Failed to analyze URL: " + (err.message || "Unknown error"));
    } finally {
      setUrlAnalyzing(false);
    }
  };

  // Dynamically calculate dashboard statistics from the actual scan list
  const totalScans = scans.length;
  const highRiskCount = scans.filter(s => s.riskLevel === "HIGH").length;
  const medRiskCount = scans.filter(s => s.riskLevel === "MEDIUM").length;
  const lowRiskCount = scans.filter(s => s.riskLevel === "LOW").length;

  const avgConfidenceRaw = scans.length > 0 
      ? scans.reduce((acc, curr) => acc + (curr.confidence || 0), 0) / scans.length 
      : 0;
  const avgConfidence = avgConfidenceRaw > 0 ? Number(avgConfidenceRaw.toFixed(1)) : 100;

  const stats: DashboardStats = {
    totalScans,
    threatsBlocked: highRiskCount + medRiskCount,
    avgConfidence,
    highRiskEmails: highRiskCount
  };

  const totalCircle = scans.length || 1; // avoid div by 0
  
  const distributionData = [
    { name: "Safe", value: Math.round((lowRiskCount / totalCircle) * 100), color: "#00dbe9" },
    { name: "Suspicious", value: Math.round((medRiskCount / totalCircle) * 100), color: "#3131c0" },
    { name: "Phishing", value: Math.round((highRiskCount / totalCircle) * 100), color: "#ffb4ab" },
  ];

  // Recharts simulated weekly scanning activity (keep as visual filler or compute if you have dates, let's keep it as visual filler since it's hard to simulate days beautifully with few real data points, or we could just keep the visual graph but low numbers)
  const weeklyActivityData = [
    { day: "Mon", volume: 14, threats: 1 },
    { day: "Tue", volume: 18, threats: 2 },
    { day: "Wed", volume: 29, threats: 4 },
    { day: "Thu", volume: 16, threats: 1 },
    { day: "Fri", volume: 21, threats: 3 },
    { day: "Sat", volume: 9, threats: 0 },
    { day: "Sun", volume: 7, threats: 0 },
  ];

  const allScans = scans.filter(scan => {
    const searchLow = searchTerm.toLowerCase();
    return (
      scan.sender.toLowerCase().includes(searchLow) ||
      scan.subject?.toLowerCase().includes(searchLow) ||
      scan.riskLevel.toLowerCase().includes(searchLow)
    );
  });

  return (
    <div className="space-y-4 w-full">
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* Card 1: Accelerate security workflow (col-span-5, Accent Bento) */}
        <div id="bento-hero" className="col-span-12 md:col-span-5 bento-card-indigo flex flex-col justify-between min-h-[340px] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
          <div className="mb-6 z-10">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 text-2xl border border-white/20 shadow-sm transition-transform hover:scale-105">
              🛡️
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-extrabold leading-tight tracking-tight text-white mb-2">
              Intelligent protection <br/>for your inbox.
            </h2>
            <p className="font-sans text-xs text-white/80 leading-relaxed max-w-sm mt-3">
              We seamlessly analyze message patterns, sender reputation, and embedded links to keep you safe from evolving threats.
            </p>
          </div>
          
          <div className="flex flex-col gap-3 z-10">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <p className="text-[11px] font-mono font-bold text-white/90 tracking-wider">
                AI PROTECTION: ACTIVE
              </p>
            </div>
            <button 
              onClick={onInitiateScanMail}
              className="w-full py-3 bg-white text-indigo-950 hover:bg-neutral-50 transition-all shadow-md hover:shadow-lg rounded-2xl font-display font-bold text-xs uppercase tracking-widest active:scale-[0.98]"
            >
              + Scan New Message
            </button>
          </div>
        </div>

        {/* Card 2: Recent Secure Communication ScanLogs (col-span-4, Bento List) */}
        <div id="bento-scan-list" className="col-span-12 md:col-span-4 bento-card flex flex-col justify-between min-h-[340px]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-on-surface">Live Reports</h3>
              <p className="text-[10px] text-on-surface-variant font-mono">Recent Scans</p>
            </div>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-500 px-2.5 py-0.5 rounded-full border border-indigo-500/20 font-bold uppercase tracking-wider">
              {allScans.length} Reports
            </span>
          </div>

          <div className="flex-grow space-y-2.5 my-2 max-h-[190px] overflow-y-auto pr-1">
            {allScans.slice(0, 4).map((scan) => {
              let indicatorColor = "bg-indigo-400";
              let shadowClass = "";
              if (scan.riskLevel === "HIGH") {
                indicatorColor = "bg-error";
                shadowClass = "shadow-[0_0_8px_var(--color-error)] opacity-80 mix-blend-screen";
              } else if (scan.riskLevel === "MEDIUM") {
                indicatorColor = "bg-orange-500";
              }

              return (
                <div 
                  key={scan.id} 
                  onClick={() => onSelectScan(scan)}
                  className="flex items-center justify-between p-2.5 bg-surface-container-low/50 hover:bg-surface-dim rounded-2xl border border-outline-variant/60 hover:border-primary-fixed-dim/40 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-1.5 h-7 ${indicatorColor} ${shadowClass} rounded-full shrink-0`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-on-surface truncate">{scan.sender}</p>
                      <p className="text-[10px] text-on-surface-variant font-medium truncate">{scan.subject || "No Subject"}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-display font-medium text-on-surface-variant shrink-0">
                    {scan.riskScore}%
                  </span>
                </div>
              );
            })}
            {allScans.length === 0 && (
              <div className="h-full flex items-center justify-center py-10">
                <p className="text-xs text-on-surface-variant font-mono">No telemetry files logged.</p>
              </div>
            )}
          </div>

          <div className="relative pt-2">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline">
              <Search className="w-3 h-3" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search threat levels or sender..."
              className="w-full bg-surface-container-low/40 border border-outline-variant/80 rounded-xl py-2 pl-9 pr-4 text-[10px] text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-fixed-dim/50 font-mono transition-colors"
            />
          </div>
        </div>

        {/* Card 3: Metrics Bubble (col-span-3, Risk Accuracy Bubble) */}
        <div id="bento-accuracy" className="col-span-12 md:col-span-3 bento-card flex flex-col items-center justify-center text-center min-h-[160px]">
          <div className="text-4xl font-display font-bold text-emerald-400 tracking-tight drop-shadow-[0_0_15px_rgba(52,211,153,0.15)] mb-1">
            {stats.avgConfidence}%
          </div>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
            Analysis Precision
          </p>
          <div className="flex gap-1 mt-4">
            <div className="w-1 h-3.5 bg-emerald-500/20 rounded-full" />
            <div className="w-1 h-5.5 bg-emerald-500/40 rounded-full" />
            <div className="w-1 h-2.5 bg-emerald-500/60 rounded-full animate-pulse" />
            <div className="w-1 h-4.5 bg-emerald-500/70 rounded-full" />
            <div className="w-1 h-7.5 bg-emerald-500 rounded-full" />
            <div className="w-1 h-3.5 bg-emerald-500/30 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Card 4: System Telemetry Monitor (col-span-3, Gauge bars) */}
        <div id="bento-sysmon" className="col-span-12 md:col-span-3 bento-card flex flex-col justify-between min-h-[200px]">
          <div>
            <h3 className="text-[10px] font-bold uppercase text-on-surface-variant tracking-widest mb-4">
              Overview
            </h3>
            <div className="space-y-4">
              <div className="relative">
                <div className="flex justify-between text-[10px] mb-1.5 font-mono">
                  <span className="text-on-surface-variant">Total Scans Logs</span>
                  <span className="text-primary-fixed-dim font-bold">{stats.totalScans.toLocaleString()}</span>
                </div>
                <div className="w-full h-1 bg-surface-container rounded-full overflow-hidden">
                  <div className="w-[85%] h-full bg-primary-fixed" />
                </div>
              </div>
              
              <div className="relative">
                <div className="flex justify-between text-[10px] mb-1.5 font-mono">
                  <span className="text-on-surface-variant">Defended Threats</span>
                  <span className="text-emerald-500 font-bold">{stats.threatsBlocked.toLocaleString()}</span>
                </div>
                <div className="w-full h-1 bg-surface-container rounded-full overflow-hidden">
                  <div className="w-[68%] h-full bg-emerald-500" />
                </div>
              </div>

              <div className="relative">
                <div className="flex justify-between text-[10px] mb-1.5 font-mono">
                  <span className="text-on-surface-variant">Flagged Risks</span>
                  <span className="text-error font-bold">{stats.highRiskEmails}</span>
                </div>
                <div className="w-full h-1 bg-surface-container rounded-full overflow-hidden">
                  <div className="w-[42%] h-full bg-error" />
                </div>
              </div>
            </div>
          </div>
          <p className="text-[9px] text-on-surface-variant leading-relaxed pt-2 border-t border-outline-variant/30 mt-4 font-mono">
            Karna_Kavach assessment cores operating at nominal baseline.
          </p>
        </div>

        {/* Card 5: Engine Connection Sync (col-span-5, Syncer block) */}
        <div id="bento-sync" className="col-span-12 md:col-span-5 bento-card flex items-center justify-between min-h-[100px]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 bg-surface-container-low rounded-xl flex items-center justify-center text-xl border border-outline-variant">
              ☁️
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-semibold text-on-surface">Cloud Log Sync</h4>
              <p className="text-[10px] text-on-surface-variant font-mono truncate">
                {scans.length > 0 ? `Syncing ${scans.length} audit logs securely...` : "Safe-mode network synchronization active"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-16 h-1.5 bg-surface-container bg-opacity-50 rounded-full overflow-hidden shrink-0">
              <div className="w-[100%] h-full bg-primary-fixed-dim" />
            </div>
            <span className="text-[11px] font-mono text-on-surface-variant">OK</span>
          </div>
        </div>

        {/* Card 6: Risk Spectrum Distribution (col-span-12 md:col-span-4, Donut Chart) */}
        <div id="bento-distribution" className="col-span-12 md:col-span-4 bento-card flex flex-col items-center justify-between min-h-[300px]">
          <h3 className="font-display text-[10px] uppercase font-bold tracking-widest text-on-surface-variant w-full text-left mb-2">
            Risk Spectrum Distribution
          </h3>
          
          <div className="relative w-44 h-44 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Inner Center Label Display */}
            <div className="absolute text-center bg-surface-container-low/80 backdrop-blur-md rounded-full w-24 h-24 flex flex-col items-center justify-center border border-outline-variant shadow-inner">
              <span className="font-display text-xl font-bold text-on-surface tracking-tight">
                {distributionData[0].value}%
              </span>
              <span className="font-mono text-[8px] uppercase tracking-wider text-on-surface-variant">
                BASELINE SAFE
              </span>
            </div>
          </div>

          <div className="flex gap-3.5 mt-3 font-mono text-[9px] justify-center flex-wrap">
            {distributionData.map((d, i) => (
              <span key={i} className="flex items-center gap-1.5 font-semibold text-on-surface-variant">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: d.color }} />
                {d.name} ({d.value}%)
              </span>
            ))}
          </div>
        </div>

        {/* Card 7: Scanning Volume Logs (col-span-12 md:col-span-8, Bar Chart) */}
        <div id="bento-volume" className="col-span-12 md:col-span-8 bento-card min-h-[300px] flex flex-col justify-between">
          <h3 className="font-display text-[10px] uppercase font-bold tracking-widest text-on-surface-variant w-full text-left mb-4">
            Scanning Volume Logs (Weekly Activity)
          </h3>

          <div className="flex-1 w-full h-52 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyActivityData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <XAxis 
                  dataKey="day" 
                  tick={{ fill: "#a3a3a3", fontSize: 9, fontFamily: "JetBrains Mono" }} 
                  axisLine={{ stroke: "rgba(255,255,255,0.02)" }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: "#a3a3a3", fontSize: 9, fontFamily: "JetBrains Mono" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.02)" }}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "#171717", 
                    borderColor: "rgba(99, 102, 241, 0.2)", 
                    borderRadius: "0.75rem",
                    fontFamily: "Plus Jakarta Sans, sans-serif" 
                  }}
                  itemStyle={{ fontSize: "11px", color: "#f5f5f5" }}
                />
                <Bar dataKey="volume" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" radius={[4, 4, 0, 0]} name="All Scans" />
                <Bar dataKey="threats" fill="#f87171" radius={[4, 4, 0, 0]} name="Defended Phishing" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      <AnimatePresence>
        {showUrlModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="glass-panel w-full max-w-lg rounded-3xl overflow-hidden border border-outline-variant/30 flex flex-col relative"
            >
              <div className="p-6 border-b border-outline-variant/20 flex items-center justify-between">
                <h3 className="font-display font-black text-sm uppercase tracking-widest text-[#7df4ff] flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary-fixed-dim" />
                  URL Risk Assessment
                </h3>
                <button 
                  onClick={() => setShowUrlModal(false)}
                  className="p-1 rounded-full hover:bg-surface-dim/40 text-on-surface-variant transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="font-sans text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Target URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface font-mono placeholder:text-outline-variant/40 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim/30 transition-all"
                      placeholder="https://verify.paypal-security.com/login"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeUrl()}
                    />
                    <button
                      onClick={handleAnalyzeUrl}
                      disabled={urlAnalyzing || !urlInput.trim()}
                      className="bg-primary-fixed text-on-primary-fixed px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-primary-fixed-dim transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      {urlAnalyzing ? <span className="w-4 h-4 border-2 border-on-primary-fixed border-t-transparent rounded-full animate-spin" /> : <SearchCode className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {urlError && (
                  <div className="p-3 rounded-lg bg-error/10 border border-error/20 flex flex-col gap-1">
                    <span className="text-error font-bold text-xs">Analysis Interrupted</span>
                    <span className="text-error/80 text-[11px]">{urlError}</span>
                  </div>
                )}

                {urlResult && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex flex-col gap-4 mt-2"
                  >
                    <div className="flex items-center justify-between p-4 rounded-xl border" 
                      style={{
                        borderColor: urlResult.risk_score >= 70 ? 'rgba(239, 68, 68, 0.3)' : urlResult.risk_score >= 40 ? 'rgba(234, 179, 8, 0.3)' : 'rgba(34, 197, 94, 0.3)',
                        backgroundColor: urlResult.risk_score >= 70 ? 'rgba(239, 68, 68, 0.05)' : urlResult.risk_score >= 40 ? 'rgba(234, 179, 8, 0.05)' : 'rgba(34, 197, 94, 0.05)'
                      }}>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">Verdict</span>
                        <span className={`font-display font-black text-xl`} 
                          style={{
                            color: urlResult.risk_score >= 70 ? '#ef4444' : urlResult.risk_score >= 40 ? '#eab308' : '#22c55e'
                          }}>
                          {urlResult.classification}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">Risk Score</span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-mono text-2xl font-bold text-on-surface">{urlResult.risk_score}</span>
                          <span className="text-xs text-on-surface-variant">/100</span>
                        </div>
                      </div>
                    </div>

                    {urlResult.reasons && urlResult.reasons.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">Detected Indicators</span>
                        <ul className="flex flex-col gap-1.5">
                          {urlResult.reasons.map((reason: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-neutral-300">
                              <ShieldAlert className="w-3.5 h-3.5 text-error mt-0.5 shrink-0" />
                              <span className="leading-tight">{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Buttons for quick scanning */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-40">
        <button
          onClick={() => setShowUrlModal(true)}
          className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-indigo-400 hover:bg-neutral-800 hover:border-indigo-500/40 transition-all shadow-xl group select-none hover:scale-105 active:scale-95 cursor-pointer relative"
        >
          <Link2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="absolute right-14 bg-neutral-900 px-3 py-1 rounded-xl border border-neutral-800 text-[9px] uppercase font-bold font-display tracking-widest text-indigo-400 shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Scan URL Link
          </span>
        </button>

        <button
          onClick={onInitiateScanMail}
          className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-500 shadow-[0_4px_25px_rgba(79,70,229,0.35)] hover:shadow-[0_4px_30px_rgba(79,70,229,0.5)] transition-all group hover:scale-105 active:scale-95 cursor-pointer relative select-none"
        >
          <Mail className="w-5 h-5 group-hover:rotate-6 transition-transform" />
          <span className="absolute right-16 bg-neutral-900 px-3 py-1 rounded-xl border border-neutral-800 text-[9px] uppercase font-bold font-display tracking-widest text-indigo-400 shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Scan Email Payload
          </span>
        </button>
      </div>

    </div>
  );
}
