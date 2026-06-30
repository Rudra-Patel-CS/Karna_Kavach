import React, { useState } from "react";
import { Brain, ShieldAlert, Key, Fingerprint, Lock, Shield, Server, Check, Activity, SearchCode, Download, Share2, CornerDownRight, Cpu, Eye, AlertTriangle, FileText, X, Printer } from "lucide-react";
import { Scan } from "../types";
import { jsPDF } from "jspdf";
import { motion, AnimatePresence } from "motion/react";
import { PieChart, Pie, Cell, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

interface IntelligenceViewProps {
  scan: Scan | null;
}

export default function IntelligenceView({ scan }: IntelligenceViewProps) {
  const [exportFormat, setExportFormat] = useState("JSON");
  const [showPreview, setShowPreview] = useState(false);

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

  // ── Build recommendations list ──
  const getRecommendations = () => {
    if (scan.recommendations && scan.recommendations.length > 0) return scan.recommendations;
    if (isHighRisk) return [
      "Do not click any links or download attachments.",
      "Block sender IP and domain at the organizational gateway.",
      "Immediately verify with the purported sender out-of-band.",
      "Report this email to your IT security team.",
      "Update email filtering rules to catch similar patterns."
    ];
    if (isMediumRisk) return [
      "Proceed with high caution. Links exhibit suspicious trackers.",
      "Do not supply any authentication credentials.",
      "Verify sender identity through an alternate communication channel."
    ];
    return [
      "Communication verified safe. Domain matching is intact.",
      "Proceed with business as usual."
    ];
  };

  const recommendations = getRecommendations();

  // ── Enhanced PDF Export ──
  const exportReport = () => {
    let format = "JSON";
    try {
      const saved = localStorage.getItem("karnakavach_settings");
      if (saved) {
        format = JSON.parse(saved).exportFormat || "JSON";
      }
    } catch(e) {}

    if (format === "PDF") {
      generatePDF();
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

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let yPos = 15;

    const checkNewPage = (needed: number) => {
      if (yPos + needed > pageHeight - 20) {
        doc.addPage();
        yPos = 15;
        drawPageBorder();
      }
    };

    const drawPageBorder = () => {
      doc.setDrawColor(0, 219, 233);
      doc.setLineWidth(0.5);
      doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
      doc.setDrawColor(99, 102, 241);
      doc.setLineWidth(0.2);
      doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
    };

    const drawSectionHeader = (title: string) => {
      checkNewPage(15);
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, yPos - 3, contentWidth, 10, "F");
      doc.setDrawColor(0, 219, 233);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos + 7, margin + contentWidth, yPos + 7);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 219, 233);
      doc.text(title.toUpperCase(), margin + 3, yPos + 4);
      yPos += 14;
    };

    // ── Page border ──
    drawPageBorder();

    // ── Header logo area ──
    doc.setFillColor(10, 15, 30);
    doc.rect(margin, yPos, contentWidth, 28, "F");
    doc.setDrawColor(0, 219, 233);
    doc.setLineWidth(0.3);
    doc.rect(margin, yPos, contentWidth, 28);

    // Shield icon (vector approximation)
    doc.setFillColor(0, 219, 233);
    doc.circle(margin + 14, yPos + 14, 8, "F");
    doc.setFillColor(10, 15, 30);
    doc.circle(margin + 14, yPos + 14, 6, "F");
    doc.setFillColor(0, 219, 233);
    doc.circle(margin + 14, yPos + 14, 3, "F");

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("KARNAKAVACH", margin + 26, yPos + 11);
    doc.setFontSize(8);
    doc.setTextColor(0, 219, 233);
    doc.text("PHISHING THREAT INTELLIGENCE AUDIT REPORT", margin + 26, yPos + 18);

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin + contentWidth - 55, yPos + 11);
    doc.text(`Report ID: ${scan.id}`, margin + contentWidth - 55, yPos + 18);
    yPos += 35;

    // ── Severity Badge ──
    const riskR = isHighRisk ? 239 : isMediumRisk ? 234 : 34;
    const riskG = isHighRisk ? 68 : isMediumRisk ? 179 : 197;
    const riskB = isHighRisk ? 68 : isMediumRisk ? 8 : 94;

    doc.setFillColor(riskR, riskG, riskB);
    doc.roundedRect(margin, yPos, contentWidth, 16, 2, 2, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`VERDICT: ${scan.riskLevel} RISK  —  SCORE: ${scan.riskScore}/100  —  CONFIDENCE: ${scan.confidence}%`, margin + 5, yPos + 11);
    yPos += 24;

    // ── Metadata Grid ──
    drawSectionHeader("Email Metadata");
    const metaRows = [
      ["Sender", scan.sender],
      ["Subject", scan.subject],
      ["Date Analyzed", new Date(scan.createdAt).toLocaleString()],
      ["Engine Used", scan.engine || "Hybrid"],
      ["Threat Category", scan.threatCategory || "General Phishing"],
      ["Reply-To", scan.replyTo || "N/A"],
    ];

    metaRows.forEach(([label, value], idx) => {
      checkNewPage(8);
      if (idx % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPos - 4, contentWidth, 8, "F");
      }
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      doc.text(label, margin + 3, yPos);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      const valLines = doc.splitTextToSize(value, contentWidth - 55);
      doc.text(valLines, margin + 50, yPos);
      yPos += Math.max(valLines.length * 5, 8);
    });
    yPos += 4;

    // ── Executive Summary ──
    drawSectionHeader("Executive Summary");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const summaryLines = doc.splitTextToSize(scan.summary, contentWidth - 6);
    summaryLines.forEach((line: string) => {
      checkNewPage(6);
      doc.text(line, margin + 3, yPos);
      yPos += 5;
    });
    yPos += 6;

    // ── Threat Vectors Table ──
    if (scan.threatVectors && scan.threatVectors.length > 0) {
      drawSectionHeader("Identified Threat Vectors");

      // Table header
      checkNewPage(10);
      doc.setFillColor(30, 41, 59);
      doc.rect(margin, yPos - 4, contentWidth, 8, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("VECTOR", margin + 3, yPos);
      doc.text("CATEGORY", margin + 80, yPos);
      doc.text("SEVERITY", margin + 120, yPos);
      doc.text("DESCRIPTION", margin + 145, yPos);
      yPos += 7;

      scan.threatVectors.forEach((v, idx) => {
        checkNewPage(12);
        if (idx % 2 === 0) {
          doc.setFillColor(248, 248, 248);
          doc.rect(margin, yPos - 4, contentWidth, 10, "F");
        }
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 30, 30);
        const titleLines = doc.splitTextToSize(v.title, 70);
        doc.text(titleLines[0], margin + 3, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(v.badge, margin + 80, yPos);
        doc.setTextColor(v.type === "critical" ? 239 : 99, v.type === "critical" ? 68 : 102, v.type === "critical" ? 68 : 241);
        doc.text(v.type.toUpperCase(), margin + 120, yPos);
        doc.setTextColor(80, 80, 80);
        const descLines = doc.splitTextToSize(v.description, 35);
        doc.text(descLines[0], margin + 145, yPos);
        yPos += 10;
      });
      yPos += 4;
    }

    // ── URL Analysis Table ──
    if (scan.urlAnalysis && scan.urlAnalysis.length > 0) {
      drawSectionHeader("URL Analysis Results");

      scan.urlAnalysis.forEach((u) => {
        checkNewPage(20);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 30, 30);
        const urlLines = doc.splitTextToSize(u.url, contentWidth - 6);
        doc.text(urlLines, margin + 3, yPos);
        yPos += urlLines.length * 5;

        doc.setFont("helvetica", "italic");
        doc.setTextColor(riskR, riskG, riskB);
        doc.text(`Classification: ${u.classification}`, margin + 5, yPos);
        yPos += 6;

        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        u.reasons.forEach((r: string) => {
          checkNewPage(6);
          const rLines = doc.splitTextToSize(`→ ${r}`, contentWidth - 15);
          doc.text(rLines, margin + 8, yPos);
          yPos += rLines.length * 5;
        });
        yPos += 6;
      });
    }

    // ── Recommendations ──
    drawSectionHeader("Security Recommendations");
    recommendations.forEach((rec, idx) => {
      checkNewPage(8);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      const recLines = doc.splitTextToSize(`${idx + 1}. ${rec}`, contentWidth - 10);
      recLines.forEach((line: string) => {
        checkNewPage(5);
        doc.text(line, margin + 5, yPos);
        yPos += 5;
      });
      yPos += 2;
    });

    // ── Score Breakdown ──
    if (scan.scoreBreakdown) {
      drawSectionHeader("Score Breakdown (Hybrid Fusion)");
      const breakdownRows = [
        ["Rule Engine Score", `${scan.scoreBreakdown.rule}/100`, `Weight: ${(scan.scoreBreakdown.weights.rule * 100).toFixed(0)}%`],
        ["ML Model Score", `${scan.scoreBreakdown.ml}/100`, `Weight: ${(scan.scoreBreakdown.weights.ml * 100).toFixed(0)}%`],
        ["AI (Gemini) Score", scan.scoreBreakdown.ai !== null ? `${scan.scoreBreakdown.ai}/100` : "N/A", `Weight: ${(scan.scoreBreakdown.weights.ai * 100).toFixed(0)}%`],
      ];
      breakdownRows.forEach(([label, value, weight], idx) => {
        checkNewPage(8);
        if (idx % 2 === 0) {
          doc.setFillColor(245, 245, 245);
          doc.rect(margin, yPos - 4, contentWidth, 8, "F");
        }
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(60, 60, 60);
        doc.text(label, margin + 3, yPos);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 30);
        doc.text(value, margin + 70, yPos);
        doc.setTextColor(100, 100, 100);
        doc.text(weight, margin + 110, yPos);
        yPos += 8;
      });
      yPos += 4;
    }

    // ── Footer ──
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`KarnaKavach Threat Intelligence Platform — Confidential Security Report — Page ${i}/${totalPages}`, pageWidth / 2, pageHeight - 12, { align: "center" });
      doc.setDrawColor(0, 219, 233);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
    }

    doc.save(`KarnaKavach_Audit_${scan.id}.pdf`);
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
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => setShowPreview(true)} className="flex items-center gap-2 px-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-lg text-[10px] font-bold uppercase tracking-wider text-neutral-300 hover:text-white hover:bg-surface-dim transition-colors cursor-pointer">
            <Eye className="w-4 h-4" /> Preview Report
          </button>
          <button onClick={exportReport} className="flex items-center gap-2 px-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-lg text-[10px] font-bold uppercase tracking-wider text-neutral-300 hover:text-white hover:bg-surface-dim transition-colors cursor-pointer">
            <Download className="w-4 h-4" /> Export {exportFormat}
          </button>
          <button onClick={shareAudit} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white shadow-lg transition-colors cursor-pointer">
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
                   {recommendations.map((rec, idx) => (
                     <li key={idx}>• {rec}</li>
                   ))}
                 </ul>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant/20 p-4 rounded-xl flex flex-col justify-center gap-2">
                 <h4 className="font-mono text-[9px] uppercase tracking-widest text-indigo-400 flex items-center gap-1.5"><SearchCode className="w-3.5 h-3.5"/> Model Confidence &amp; Timeline</h4>
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

      {/* ── Interactive PDF Report Preview Modal ── */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 30 }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-outline-variant/30 flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
              style={{ background: "linear-gradient(180deg, #0f172a 0%, #0a0f1e 100%)" }}
            >
              {/* Preview Header */}
              <div className="p-5 border-b border-cyan-500/20 flex items-center justify-between sticky top-0 z-10 backdrop-blur-xl" style={{ background: "rgba(10,15,30,0.95)" }}>
                <h3 className="font-display font-black text-sm uppercase tracking-widest text-[#00dbe9] flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Report Preview
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => { generatePDF(); setShowPreview(false); }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#00dbe9] text-[#0a0f1e] rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[#00c4d6] transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4" /> Download PDF
                  </button>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="p-2 rounded-full hover:bg-white/5 text-neutral-400 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Simulated Document Page */}
              <div className="p-6">
                <div className="bg-white text-black rounded-xl shadow-xl overflow-hidden border-2 border-[#00dbe9]/30">
                  
                  {/* Document Header */}
                  <div className="bg-gradient-to-r from-[#0a0f1e] to-[#1e293b] p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#00dbe9]/20 border-2 border-[#00dbe9] flex items-center justify-center">
                        <Shield className="w-6 h-6 text-[#00dbe9]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg tracking-wider">KARNAKAVACH</h4>
                        <p className="text-[#00dbe9] text-[10px] uppercase tracking-widest font-mono">Phishing Threat Intelligence Report</p>
                      </div>
                    </div>
                    <div className="text-right text-[9px] text-neutral-400 font-mono">
                      <p>Generated: {new Date().toLocaleDateString()}</p>
                      <p>ID: {scan.id.slice(0, 12)}...</p>
                    </div>
                  </div>

                  {/* Verdict Banner */}
                  <div className="px-6 py-4" style={{ backgroundColor: `${colorHex}15`, borderBottom: `2px solid ${colorHex}` }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldAlert className="w-5 h-5" style={{ color: colorHex }} />
                        <span className="font-bold text-sm uppercase tracking-wider" style={{ color: colorHex }}>
                          {scan.riskLevel} RISK — Score: {scan.riskScore}/100
                        </span>
                      </div>
                      <span className="text-xs text-neutral-500 font-mono">Confidence: {scan.confidence}%</span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="px-6 py-4 border-b border-neutral-200">
                    <h5 className="font-bold text-[10px] uppercase tracking-widest text-neutral-400 mb-3">Email Metadata</h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        ["Sender", scan.sender],
                        ["Subject", scan.subject],
                        ["Date", new Date(scan.createdAt).toLocaleString()],
                        ["Engine", scan.engine || "Hybrid"],
                        ["Category", scan.threatCategory || "General"],
                        ["Reply-To", scan.replyTo || "N/A"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex gap-2">
                          <span className="font-bold text-neutral-500 shrink-0 w-16">{label}:</span>
                          <span className="text-neutral-700 truncate">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="px-6 py-4 border-b border-neutral-200">
                    <h5 className="font-bold text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Executive Summary</h5>
                    <p className="text-xs text-neutral-600 leading-relaxed">{scan.summary}</p>
                  </div>

                  {/* Threat Vectors */}
                  {scan.threatVectors && scan.threatVectors.length > 0 && (
                    <div className="px-6 py-4 border-b border-neutral-200">
                      <h5 className="font-bold text-[10px] uppercase tracking-widest text-neutral-400 mb-3">Threat Vectors</h5>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-neutral-100">
                            <th className="text-left p-2 font-bold text-neutral-500 uppercase text-[9px]">Vector</th>
                            <th className="text-left p-2 font-bold text-neutral-500 uppercase text-[9px]">Category</th>
                            <th className="text-left p-2 font-bold text-neutral-500 uppercase text-[9px]">Severity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scan.threatVectors.map((v, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? "bg-neutral-50" : ""}>
                              <td className="p-2 text-neutral-700">{v.title}</td>
                              <td className="p-2 text-neutral-500">{v.badge}</td>
                              <td className="p-2">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${v.type === "critical" ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600"}`}>
                                  {v.type}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* URLs */}
                  {scan.urlAnalysis && scan.urlAnalysis.length > 0 && (
                    <div className="px-6 py-4 border-b border-neutral-200">
                      <h5 className="font-bold text-[10px] uppercase tracking-widest text-neutral-400 mb-3">URL Analysis</h5>
                      {scan.urlAnalysis.map((u, idx) => (
                        <div key={idx} className="mb-3 last:mb-0 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                          <p className="text-xs font-mono text-neutral-700 break-all">{u.url}</p>
                          <span className={`mt-1 inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            u.classification === "High Risk" ? "bg-red-100 text-red-600" :
                            u.classification === "Suspicious" ? "bg-yellow-100 text-yellow-700" :
                            "bg-green-100 text-green-600"
                          }`}>
                            {u.classification}
                          </span>
                          <ul className="mt-2 text-[10px] text-neutral-500 space-y-0.5">
                            {u.reasons.map((r, ri) => <li key={ri}>→ {r}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recommendations */}
                  <div className="px-6 py-4 border-b border-neutral-200">
                    <h5 className="font-bold text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Security Recommendations</h5>
                    <ol className="list-decimal list-inside text-xs text-neutral-600 space-y-1.5">
                      {recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ol>
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-3 bg-neutral-100 text-center border-t border-[#00dbe9]/20">
                    <p className="text-[8px] text-neutral-400 font-mono uppercase tracking-widest">
                      KarnaKavach Threat Intelligence Platform — Confidential Security Report
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
