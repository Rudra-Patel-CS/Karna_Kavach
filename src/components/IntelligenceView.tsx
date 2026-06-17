import React, { useState } from "react";
import { Brain, ShieldAlert, Key, Fingerprint, Lock, Shield, Server, Check, Activity, SearchCode, Download, Share2, CornerDownRight, Cpu, Eye, AlertTriangle } from "lucide-react";
import { Scan } from "../types";
import { jsPDF } from "jspdf";
import { motion, AnimatePresence } from "motion/react";
import { PieChart, Pie, Cell, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

interface IntelligenceViewProps {
  scan: Scan | null;
}

export default function IntelligenceView({ scan }: IntelligenceViewProps) {
  const [exportFormat, setExportFormat] = useState("JSON");

  React.useEffect(() => {
    const applySettings = () => {
      const savedSettingsStr = localStorage.getItem("karnakavach_settings");
      if (savedSettingsStr) {
         try {
           const parsedSettings = JSON.parse(savedSettingsStr);
           if (parsedSettings.exportFormat) setExportFormat(parsedSettings.exportFormat);
         } catch(e) {}
      }
    };
    applySettings();
    window.addEventListener("karnakavach_settings_updated", applySettings);
    return () => window.removeEventListener("karnakavach_settings_updated", applySettings);
  }, []);

  if (!scan) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[60vh] text-center gap-4">
        <div className="w-20 h-20 bg-surface-container-low/50 rounded-full flex items-center justify-center border border-outline-variant/30">
          <Brain className="w-10 h-10 text-neutral-500" />
        </div>
        <div className="max-w-md">
          <h3 className="font-display font-black text-sm text-neutral-200 uppercase tracking-widest mb-2">No Active Intelligence</h3>
          <p className="font-sans text-xs text-neutral-400">
            Select a scan from the Dashboard or History tab, or run a new evaluation in the Analyzer to view the deep intelligence report here.
          </p>
        </div>
      </div>
    );
  }

  const isHighRisk = scan.riskLevel === "HIGH";
  const isMediumRisk = scan.riskLevel === "MEDIUM";
  const colorHex = isHighRisk ? "#ef4444" : isMediumRisk ? "#eab308" : "#22c55e";

  const radarData = [
    { subject: 'Urgency / Pressure', A: scan.threatVectors ? scan.threatVectors.filter(v => v.type === 'critical' || v.type === 'warning').length * 20 : 10, fullMark: 100 },
    { subject: 'Sender Spoofing', A: scan.riskLevel === "HIGH" ? 90 : 20, fullMark: 100 },
    { subject: 'URL Validity', A: scan.riskLevel === "HIGH" ? 85 : 15, fullMark: 100 },
    { subject: 'Layout Suspicion', A: scan.riskScore > 50 ? 60 : 10, fullMark: 100 },
    { subject: 'Keyword Triggers', A: scan.riskScore, fullMark: 100 },
  ];

  const exportReport = () => {
    let format = "JSON";
    try {
      const saved = localStorage.getItem("karnakavach_settings");
      if (saved) {
        format = JSON.parse(saved).exportFormat || "JSON";
      }
    } catch(e) {}

    if (format === "PDF") {
      const doc = new jsPDF();
      let yPos = 20;
      
      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text("KarnaKavach Phishing Audit Report", 15, yPos);
      yPos += 15;
      
      doc.setFontSize(12);
      doc.text(`Sender: ${scan.sender}`, 15, yPos);
      yPos += 8;
      doc.text(`Subject: ${scan.subject}`, 15, yPos);
      yPos += 8;
      doc.text(`Date: ${new Date(scan.createdAt).toLocaleString()}`, 15, yPos);
      yPos += 15;

      doc.setFontSize(16);
      doc.setTextColor(scan.riskLevel === "HIGH" ? 239 : scan.riskLevel === "MEDIUM" ? 234 : 34, 
                       scan.riskLevel === "HIGH" ? 68 : scan.riskLevel === "MEDIUM" ? 179 : 197, 
                       scan.riskLevel === "HIGH" ? 68 : scan.riskLevel === "MEDIUM" ? 8 : 94);
      doc.text(`Severity: ${scan.riskLevel} RISK (Score: ${scan.riskScore}/100)`, 15, yPos);
      yPos += 15;

      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("Executive Summary", 15, yPos);
      yPos += 8;

      doc.setFontSize(11);
      const summaryLines = doc.splitTextToSize(scan.summary, 180);
      doc.text(summaryLines, 15, yPos);
      yPos += (summaryLines.length * 6) + 10;

      if (scan.threatVectors && scan.threatVectors.length > 0) {
          doc.setFontSize(14);
          doc.text("Identified Threat Vectors", 15, yPos);
          yPos += 10;

          scan.threatVectors.forEach((v: any) => {
              if (yPos > 270) {
                  doc.addPage();
                  yPos = 20;
              }
              doc.setFontSize(12);
              doc.setFont("helvetica", "bold");
              doc.text(`• ${v.title} (${v.badge})`, 15, yPos);
              yPos += 6;

              doc.setFontSize(11);
              doc.setFont("helvetica", "normal");
              const descLines = doc.splitTextToSize(v.description, 175);
              doc.text(descLines, 20, yPos);
              yPos += (descLines.length * 6) + 6;
          });
      }

      if (scan.urlAnalysis && scan.urlAnalysis.length > 0) {
          yPos += 5;
          if (yPos > 260) { doc.addPage(); yPos = 20; }
          
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text("URL Analysis", 15, yPos);
          yPos += 10;

          scan.urlAnalysis.forEach((u: any) => {
              if (yPos > 270) { doc.addPage(); yPos = 20; }
              doc.setFontSize(11);
              doc.setFont("helvetica", "bold");
              const urlLines = doc.splitTextToSize(u.url, 175);
              doc.text(urlLines, 15, yPos);
              yPos += (urlLines.length * 6);

              doc.setFont("helvetica", "italic");
              doc.text(`Classification: ${u.classification}`, 20, yPos);
              yPos += 6;

              doc.setFont("helvetica", "normal");
              u.reasons.forEach((r: string) => {
                 const rLines = doc.splitTextToSize(`- ${r}`, 170);
                 doc.text(rLines, 25, yPos);
                 yPos += (rLines.length * 6);
              });
              yPos += 6;
          });
      }

      doc.save(`KarnaKavach_Audit_${scan.id}.pdf`);
      return;
    }

    const reportData = JSON.stringify(scan, null, 2);
    const blob = new Blob([reportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threat-report-${scan.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const shareAudit = async () => {
    const shareText = `KarnaKavach Risk Score: ${scan.riskScore}/100. Verdict: ${scan.riskLevel}.\n\nSummary:\n${scan.summary}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Phishing Audit: ${scan.sender}`,
          text: shareText
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        alert("Audit summary copied to clipboard!");
      } catch (err) {
        console.error("Error copying to clipboard:", err);
        alert("Failed to copy to clipboard.");
      }
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl pb-10">
      
      {/* Header operations row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display font-black text-xs uppercase tracking-widest text-[#7df4ff] flex items-center gap-2">
            <Brain className="w-4 h-4 text-[#00dbe9]" />
            Deep Intelligence Audit
          </h2>
          <p className="font-sans text-xs text-on-surface-variant mt-1">
            Analyzing specific vector paths and cognitive models for {scan.sender}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportReport} className="flex items-center gap-2 px-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-lg text-[10px] font-bold uppercase tracking-wider text-neutral-300 hover:text-white hover:bg-surface-dim transition-colors">
            <Download className="w-4 h-4" /> Export {exportFormat}
          </button>
          <button onClick={shareAudit} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white shadow-lg transition-colors">
            <Share2 className="w-4 h-4" /> Share Audit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main large gauge and verdict (Span 4) */}
        <div className="lg:col-span-4 glass-panel rounded-3xl p-6 flex flex-col items-center text-center justify-center border relative overflow-hidden" 
             style={{ borderColor: `${colorHex}40`, backgroundColor: `${colorHex}05` }}>
            <div className="absolute top-0 right-0 w-40 h-40 blur-3xl opacity-20 pointer-events-none" style={{ backgroundColor: colorHex }} />
            
            <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-neutral-400 mb-6 z-10">
              Overall Phishing Verdict
            </h3>

            {/* Gauge */}
            <div className="relative w-48 h-48 flex items-center justify-center z-10 mb-4">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#122131" strokeWidth="8" />
                <circle 
                  cx="50" cy="50" r="42" fill="none" 
                  stroke={colorHex} strokeWidth="8" strokeDasharray="263.89"
                  strokeDashoffset={263.89 - (263.89 * scan.riskScore) / 100}
                  strokeLinecap="round" className="transition-all duration-1000 ease-out drop-shadow-xl"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="font-display text-5xl font-black" style={{ color: colorHex }}>{scan.riskScore}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-outline">Risk Score</span>
              </div>
            </div>

            <div className="px-5 py-2 rounded-xl flex items-center gap-2 shadow-lg z-10 bg-black/40 border" style={{ borderColor: `${colorHex}40`, color: colorHex }}>
              <ShieldAlert className="w-4 h-4 animate-pulse" />
              <span className="font-display font-extrabold text-xs uppercase tracking-widest">{scan.riskLevel} SEVERITY THREAT</span>
            </div>
            
            <div className="mt-6 flex flex-col w-full gap-2 text-left bg-black/30 p-4 rounded-xl border border-white/5 z-10">
              <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-500">Sender Trust Analysis</span>
              <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${100 - scan.riskScore}%`, backgroundColor: colorHex }} />
              </div>
              <div className="flex justify-between mt-1 items-center">
                <span className="font-sans text-[10px] font-bold text-neutral-300">Reputation Identity Match</span>
                <span className="font-mono text-[10px]" style={{ color: colorHex }}>{100 - scan.riskScore}% Match</span>
              </div>
            </div>
        </div>

        {/* AI Explanations and Remediation (Span 8) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          <div className="glass-panel p-6 rounded-3xl border border-neutral-800 flex flex-col gap-4 relative overflow-hidden">
            <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-[#7df4ff] flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-[#00dbe9]" />
              Synthetic Intelligence Breakdown
            </h3>
            <p className="font-sans text-[13px] leading-relaxed text-on-surface whitespace-pre-line bg-surface-container-low/40 p-5 rounded-2xl border border-outline-variant/15">
              {scan.summary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div className="bg-surface-container-lowest border border-outline-variant/20 p-4 rounded-xl">
                 <h4 className="font-mono text-[9px] uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-1.5"><Check className="w-3.5 h-3.5"/> Recommended Remediation</h4>
                 <ul className="text-xs space-y-2 text-neutral-300">
                   {isHighRisk ? (
                     <>
                      <li>• Do not click any links or download attachments.</li>
                      <li>• Block sender IP and domain at the organizational gateway.</li>
                      <li>• Immediately verify with the purported sender out-of-band.</li>
                     </>
                   ) : isMediumRisk ? (
                     <>
                      <li>• Proceed with high caution. Links exhibit suspicious trackers.</li>
                      <li>• Do not supply any authentication credentials.</li>
                     </>
                   ) : (
                     <>
                      <li>• Communication verified safe. Domain matching is intact.</li>
                      <li>• Proceed with business as usual.</li>
                     </>
                   )}
                 </ul>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant/20 p-4 rounded-xl flex flex-col justify-center gap-2">
                 <h4 className="font-mono text-[9px] uppercase tracking-widest text-indigo-400 flex items-center gap-1.5"><SearchCode className="w-3.5 h-3.5"/> Model Confidence & Timeline</h4>
                 <div className="flex gap-4 items-center">
                    <div className="flex flex-col">
                      <span className="text-2xl font-display font-black text-indigo-400">{scan.confidence}%</span>
                      <span className="text-[9px] text-outline uppercase font-mono tracking-wider">Engine Confidence</span>
                    </div>
                    <div className="w-px h-10 bg-outline-variant/20" />
                    <div className="flex flex-col">
                      <span className="font-sans text-xs font-bold text-neutral-200">{new Date(scan.createdAt).toLocaleString()}</span>
                      <span className="text-[9px] text-outline uppercase font-mono tracking-wider">Analysis Executed Timestamp</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
          
        </div>

        {/* Radar Chart & Suspicious Keywords (Bottom Row) */}
        <div className="lg:col-span-6 glass-panel p-6 rounded-3xl border border-neutral-800 min-h-[300px] flex flex-col">
          <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-neutral-400 flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-outline" /> Threat Vector Architecture
          </h3>
          <div className="flex-1 w-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#a3a3a3", fontSize: 9, fontFamily: "JetBrains Mono" }} />
                <Radar name="Threat Vector" dataKey="A" stroke={colorHex} fill={colorHex} fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vectors & URL Risk Breakdown */}
        <div className="lg:col-span-6 glass-panel p-6 rounded-3xl border border-neutral-800 max-h-[350px] overflow-y-auto">
          <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-neutral-400 flex items-center gap-2 mb-4 sticky top-0 bg-surface-container-low/90 backdrop-blur-md pb-2 z-10 pt-2 -mt-2">
            <Eye className="w-4 h-4 text-outline" /> Detailed Vector Extraction
          </h3>
          <div className="space-y-3">
            {scan.threatVectors && scan.threatVectors.length > 0 ? (
              scan.threatVectors.map((vector, idx) => (
                <div key={`vec-${idx}`} className="p-3 bg-surface-container-lowest/80 border border-outline-variant/15 rounded-xl text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <strong className="text-neutral-200 font-bold flex items-center gap-2">
                       {vector.type === "critical" && <AlertTriangle className="w-3.5 h-3.5 text-error"/>} 
                       {vector.title}
                    </strong>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-mono tracking-wider uppercase font-bold border ${vector.type === "critical" ? "bg-error/10 text-error border-error/20" : "bg-neutral-800 text-neutral-400 border-neutral-700"}`}>
                      {vector.badge}
                    </span>
                  </div>
                  <p className="text-neutral-400 leading-relaxed font-sans mt-1.5 border-l-2 pl-2" style={{ borderColor: vector.type === "critical" ? "#ef4444" : "#4f46e5" }}>
                    {vector.description}
                  </p>
                </div>
              ))
            ) : (
               <p className="text-xs text-neutral-500 font-mono text-center mt-4">No granular threat vectors logged.</p>
            )}

            {scan.urlAnalysis && scan.urlAnalysis.length > 0 && (
              <div className="mt-6 pt-4 border-t border-outline-variant/10">
                <h4 className="font-mono text-[9px] uppercase tracking-widest text-[#7df4ff] mb-3">Extracted URL Diagnostics</h4>
                {scan.urlAnalysis.map((urlData, idx) => (
                  <div key={`url-${idx}`} className="p-3 bg-surface-container-lowest border border-outline-variant/20 rounded-xl mb-3 last:mb-0">
                    <div className="flex justify-between items-start mb-2">
                      <strong className="text-neutral-300 font-mono text-[10px] break-all border-b border-outline-variant/20 pb-0.5">{urlData.url}</strong>
                      <span className={`px-2 py-1 ml-3 shrink-0 rounded text-[9px] font-bold uppercase tracking-wider ${
                          urlData.classification === "High Risk" ? "bg-error/20 text-error" : 
                          urlData.classification === "Suspicious" ? "bg-secondary-container/30 text-secondary" : 
                          "bg-emerald-500/10 text-emerald-400"
                        }`}>
                        {urlData.classification}
                      </span>
                    </div>
                    {urlData.reasons.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {urlData.reasons.map((reason, rIdx) => (
                          <li key={rIdx} className="text-[11px] text-neutral-400 font-sans flex items-start gap-1.5">
                            <CornerDownRight className="w-3 h-3 text-outline mt-0.5 shrink-0" /> {reason}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

