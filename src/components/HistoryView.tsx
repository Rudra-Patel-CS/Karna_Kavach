import { useState } from "react";
import { Search, ShieldAlert, Cpu, Trash2, Calendar, FileText, ArrowRight, ArrowUpRight } from "lucide-react";
import { Scan } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface HistoryViewProps {
  scans: Scan[];
  onSelectScan: (scan: Scan) => void;
  onClearHistory?: () => void;
}

export default function HistoryView({ scans, onSelectScan, onClearHistory }: HistoryViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");

  // Predefined initial logs matching the user's mockup dashboard entries
  const predefinedLogs: Scan[] = [
    {
      id: "pre_1",
      sender: "security@secure-update.net",
      subject: "IMMEDIATE RESOLUTION: Account status suspended in 24 hours",
      body: "Please click verification link here...",
      riskScore: 94,
      riskLevel: "HIGH",
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      summary: "Severe hallmarks of zero-day credential harvesting mimicking secure Microsoft gateways.",
      confidence: 98.4,
      threatVectors: [
        {
          title: "Spoofed Authentication Gate",
          description: "Mimics secure login structures.",
          badge: "Social Eng",
          type: "critical"
        }
      ]
    },
    {
      id: "pre_2",
      sender: "a.smith@cyber-partner.co",
      subject: "Project Alpha Q3 updates and files",
      body: "Attached is the spreadsheet...",
      riskScore: 12,
      riskLevel: "LOW",
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      summary: "Normal safe communication pattern, verified authentication logs matching normal partner keys.",
      confidence: 99.2,
      threatVectors: []
    },
    {
      id: "pre_3",
      sender: "billing@netflix-updates.net",
      subject: "Your subscription billing holds - Update credentials",
      body: "Your account is on hold - Update billing info",
      riskScore: 58,
      riskLevel: "MEDIUM",
      createdAt: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
      summary: "Domain verification mismatch. High frequency indicators for social engineering scam template.",
      confidence: 91.0,
      threatVectors: []
    }
  ];

  const mergedLogs = [...scans, ...predefinedLogs].filter((item) => {
    const searchLow = searchTerm.toLowerCase();
    const matchesSearch = 
      item.sender.toLowerCase().includes(searchLow) ||
      item.subject.toLowerCase().includes(searchLow);
    
    if (riskFilter === "ALL") return matchesSearch;
    return matchesSearch && item.riskLevel === riskFilter;
  });

  const exportToCSV = () => {
    if (mergedLogs.length === 0) return;

    // Define CSV Headers
    const headers = ["ID", "Alert Date", "Sender", "Subject", "Risk Level", "Risk Score", "Confidence (%)", "Summary"];
    
    // Escape specific CSV values that might contain commas or newlines
    const escapeCSV = (str: string) => {
      const cleanStr = (str || "").toString();
      return `"${cleanStr.replace(/"/g, '""')}"`;
    };

    const csvRows = mergedLogs.map(log => {
      return [
        log.id,
        new Date(log.createdAt).toISOString(),
        escapeCSV(log.sender),
        escapeCSV(log.subject),
        log.riskLevel,
        log.riskScore,
        log.confidence,
        escapeCSV(log.summary)
      ].join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `karnakavach_cognitive_logs_${new Date().getTime()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="font-display font-black text-xs uppercase tracking-widest text-primary-fixed-dim">
            Cognitive Diagnostics Logs
          </h2>
          <p className="font-sans text-xs text-on-surface-variant mt-1">
            Browse, filter, and audit historic deep packet scans & threat metadata.
          </p>
        </div>

        {onClearHistory && scans.length > 0 && (
          <button 
            onClick={onClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-error-container/10 border border-error/20 hover:bg-error-container/20 text-error rounded-md text-xs font-mono font-bold uppercase transition-colors tracking-wider select-none cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            CLEAR RECENT HISTORY
          </button>
        )}
      </div>

      {/* Filter and search action bar */}
      <div className="glass-panel p-4 rounded-3xl flex flex-col md:flex-row gap-4 items-center justify-between border border-neutral-800">
        
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search email domains, sender addresses, or subject keywords..."
            className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg py-2.5 pl-10 pr-4 text-xs font-mono text-on-surface placeholder:text-outline-variant/40 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim/30 transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="flex bg-surface-container-low border border-outline-variant/20 p-1 rounded-lg gap-1 select-none font-sans font-bold text-[10px] tracking-widest uppercase shrink-0 w-full sm:w-auto overflow-x-auto justify-between">
            {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRiskFilter(r)}
                className={`p-2 px-3 rounded-md transition-colors cursor-pointer text-center flex-1 sm:flex-initial ${
                  riskFilter === r 
                    ? "bg-primary-container/10 text-primary-fixed-dim font-black shadow-[0_0_8px_rgba(0,219,233,0.1)]" 
                    : "text-outline hover:text-on-surface"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <button 
            onClick={exportToCSV}
            disabled={mergedLogs.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-fixed-dim hover:bg-primary text-background rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            EXPORT TO CSV
          </button>
        </div>

      </div>

      {/* Main logs display list */}
      <div className="flex flex-col gap-4">
        {mergedLogs.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center text-neutral-500 font-mono text-xs border border-neutral-800 flex flex-col items-center gap-3">
            <Calendar className="w-8 h-8 text-outline-variant animate-pulse" />
            No cyber diagnostics match the given configuration. Try launching a raw scan first.
          </div>
        ) : (
          mergedLogs.map((log) => {
            const riskBg = 
              log.riskLevel === "HIGH" 
                ? "border border-error/25 bg-error-container/5"
                : log.riskLevel === "MEDIUM"
                ? "border border-secondary-container/20 bg-secondary-container/5"
                : "border border-primary-fixed-dim/10 bg-primary-container/2";

            const scoreBadge = 
              log.riskLevel === "HIGH" 
                ? "text-error border-error/30" 
                : log.riskLevel === "MEDIUM"
                ? "text-secondary border-secondary/35"
                : "text-primary-fixed-dim border-primary-fixed-dim/30";

            return (
              <div 
                key={log.id}
                onClick={() => onSelectScan(log)}
                className={`glass-panel p-5 rounded-3xl cursor-pointer hover:scale-[1.002] active:scale-[0.998] transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${riskBg}`}
              >
                <div className="flex gap-4 items-start min-w-0">
                  <div className={`w-11 h-11 rounded-lg border flex items-center justify-center shrink-0 ${scoreBadge}`}>
                    <span className="font-display font-bold text-base leading-none">{log.riskScore}</span>
                  </div>
                  
                  <div className="space-y-1 min-w-0">
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className="font-sans font-bold text-xs truncate max-w-[220px] text-on-surface">
                        {log.sender}
                      </span>
                      <span className="font-mono text-[9px] text-outline">•</span>
                      <span className="font-mono text-[9px] text-outline">
                        {new Date(log.createdAt).toLocaleDateString()} at {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h4 className="font-sans font-medium text-xs text-on-surface-variant truncate max-w-sm md:max-w-md lg:max-w-xl">
                      {log.subject}
                    </h4>

                    <p className="font-mono text-[10px] text-outline line-clamp-1">
                      {log.summary}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-center self-end md:self-center shrink-0">
                  <span className={`px-2 py-0.5 rounded font-display font-extrabold text-[9px] tracking-widest uppercase border ${scoreBadge}`}>
                    {log.riskLevel} Risk
                  </span>
                  <button className="p-1 px-3 bg-surface-container-high/40 hover:bg-surface-bright/40 text-xs text-primary-fixed-dim rounded font-mono text-[10px] uppercase font-bold border border-outline-variant/20 flex items-center gap-1.5 transition-colors cursor-pointer">
                    Assess
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
