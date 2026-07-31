import React, { useState } from "react";
import { Brain, ShieldAlert, Key, Fingerprint, Lock, Shield, Server, Check, Activity, SearchCode, Download, Share2, CornerDownRight, Cpu, Eye, AlertTriangle, FileText, X, Printer } from "lucide-react";
import { Scan } from "../types";
import { jsPDF } from "jspdf";
import { motion, AnimatePresence } from "motion/react";
import { PieChart, Pie, Cell, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

interface IntelligenceViewProps {
  scan: Scan | null;
  user?: { displayName?: string | null; email?: string | null } | null;
}

export default function IntelligenceView({ scan, user }: IntelligenceViewProps) {
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
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin;
    let sectionCounter = 0;

    // ── Print-Friendly Color Palette ──
    const C = {
      primary:      [43, 84, 126]   as [number, number, number],
      primaryLight: [232, 236, 240] as [number, number, number],
      dark:         [26, 26, 26]    as [number, number, number],
      body:         [55, 65, 81]    as [number, number, number],
      muted:        [107, 114, 128] as [number, number, number],
      light:        [156, 163, 175] as [number, number, number],
      border:       [209, 213, 219] as [number, number, number],
      rowAlt:       [247, 248, 250] as [number, number, number],
      white:        [255, 255, 255] as [number, number, number],
      success:      [22, 163, 74]   as [number, number, number],
      successBg:    [240, 253, 244] as [number, number, number],
      warning:      [161, 98, 7]    as [number, number, number],
      warningBg:    [254, 252, 232] as [number, number, number],
      danger:       [185, 28, 28]   as [number, number, number],
      dangerBg:     [254, 242, 242] as [number, number, number],
      mlBlue:       [59, 130, 246]  as [number, number, number],
      ruleViolet:   [124, 58, 237]  as [number, number, number],
      aiSky:        [14, 165, 233]  as [number, number, number],
    };

    const riskColor = (): [number, number, number] => isHighRisk ? C.danger : isMediumRisk ? C.warning : C.success;
    const riskBg    = (): [number, number, number] => isHighRisk ? C.dangerBg : isMediumRisk ? C.warningBg : C.successBg;
    const verdictLabel = (): string => isHighRisk ? "PHISHING" : isMediumRisk ? "SUSPICIOUS" : "SAFE";

    // ── Continuation header for pages 2+ ──
    const drawContinuationHeader = () => {
      doc.setFillColor(...C.primary);
      doc.rect(margin, 10, contentWidth, 7, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.white);
      doc.text("KARNAKAVACH  \u2014  PHISHING THREAT INTELLIGENCE REPORT", margin + 3, 15);
      doc.setFont("helvetica", "normal");
      const idShort = scan.id.length > 24 ? scan.id.slice(0, 24) + "..." : scan.id;
      doc.text(`Report ID: ${idShort}`, margin + contentWidth - 50, 15);
      yPos = 24;
    };

    // ── Page-break helper ──
    const checkNewPage = (needed: number) => {
      if (yPos + needed > pageHeight - 25) {
        doc.addPage();
        drawContinuationHeader();
      }
    };

    // ── Section title ──
    const drawSectionTitle = (title: string) => {
      sectionCounter++;
      checkNewPage(18);
      yPos += 5;
      doc.setFillColor(...C.primaryLight);
      doc.rect(margin, yPos - 1, contentWidth, 9, "F");
      doc.setFillColor(...C.primary);
      doc.rect(margin, yPos - 1, 1.5, 9, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.primary);
      doc.text(`${sectionCounter}. ${title.toUpperCase()}`, margin + 5, yPos + 5.5);
      yPos += 14;
    };

    // ── Key-value table row ──
    const drawKVRow = (label: string, value: string, isAlt: boolean) => {
      checkNewPage(9);
      const rowH = 8;
      if (isAlt) {
        doc.setFillColor(...C.rowAlt);
        doc.rect(margin, yPos, contentWidth, rowH, "F");
      }
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.15);
      doc.rect(margin, yPos, 50, rowH);
      doc.rect(margin + 50, yPos, contentWidth - 50, rowH);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.primary);
      doc.text(label, margin + 3, yPos + 5.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.dark);
      const valText = doc.splitTextToSize(value || "N/A", contentWidth - 56);
      doc.text(valText[0], margin + 53, yPos + 5.5);
      yPos += rowH;
    };

    // ── Bordered data table ──
    const drawBorderedTableRow = (cells: { text: string; width: number }[], isHeader: boolean, isAlt: boolean) => {
      const rowH = 7;
      checkNewPage(rowH + 2);
      if (isHeader) {
        doc.setFillColor(...C.primary);
        doc.rect(margin, yPos, contentWidth, rowH, "F");
        doc.setTextColor(...C.white);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
      } else {
        if (isAlt) {
          doc.setFillColor(...C.rowAlt);
          doc.rect(margin, yPos, contentWidth, rowH, "F");
        }
        doc.setTextColor(...C.body);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
      }
      let xOff = margin + 3;
      cells.forEach(cell => {
        const t = doc.splitTextToSize(cell.text, cell.width - 5)[0] || "";
        doc.text(t, xOff, yPos + 5);
        xOff += cell.width;
      });
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.15);
      let bx = margin;
      cells.forEach(cell => { doc.rect(bx, yPos, cell.width, rowH); bx += cell.width; });
      yPos += rowH;
    };

    // ── Horizontal progress bar ──
    const drawProgressBar = (
      label: string, value: number, maxVal: number,
      barColor: [number, number, number],
      x: number, y: number, barWidth: number
    ) => {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.body);
      doc.text(label, x, y);
      const barY = y + 2;
      const barH = 4;
      const pct = Math.min(value / maxVal, 1);
      doc.setFillColor(...C.primaryLight);
      doc.roundedRect(x, barY, barWidth, barH, 1.5, 1.5, "F");
      if (pct > 0) {
        doc.setFillColor(...barColor);
        doc.roundedRect(x, barY, Math.max(barWidth * pct, 3), barH, 1.5, 1.5, "F");
      }
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.dark);
      doc.text(`${value}/${maxVal}`, x + barWidth + 3, y + 4);
    };

    // ══════════════════════════════════════════════════════
    //  REPORT HEADER
    // ══════════════════════════════════════════════════════

    // Top accent strip
    doc.setFillColor(...C.primary);
    doc.rect(margin, margin, contentWidth, 2, "F");
    yPos = margin + 6;

    // Shield icon
    const cx = margin + 10, cy = yPos + 8;
    doc.setFillColor(...C.primary);
    doc.circle(cx, cy, 7, "F");
    doc.setFillColor(...C.white);
    doc.circle(cx, cy, 5.5, "F");
    doc.setFillColor(...C.primary);
    doc.circle(cx, cy, 3, "F");
    doc.setFillColor(...C.white);
    doc.circle(cx, cy, 1.5, "F");

    // Title text
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.dark);
    doc.text("KARNAKAVACH", margin + 22, yPos + 6);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.primary);
    doc.text("Phishing Threat Intelligence Report", margin + 22, yPos + 13);
    yPos += 20;

    // Separator
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, margin + contentWidth, yPos);
    yPos += 5;

    // Metadata grid
    const headerMeta: [string, string][] = [
      ["Report ID",       scan.id],
      ["Generated",       new Date().toLocaleString()],
      ["Report Version",  "1.0"],
      ["Analysis Engine", scan.engine || "Hybrid"],
      ["Analyst",         user?.displayName || user?.email || "System Generated"],
    ];
    doc.setFontSize(8);
    headerMeta.forEach(([label, value], idx) => {
      const col = idx % 2 === 0 ? 0 : contentWidth / 2;
      const row = Math.floor(idx / 2);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.muted);
      doc.text(`${label}:`, margin + col, yPos + row * 5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.dark);
      const truncVal = value.length > 38 ? value.slice(0, 35) + "..." : value;
      doc.text(truncVal, margin + col + 28, yPos + row * 5);
    });
    yPos += Math.ceil(headerMeta.length / 2) * 5 + 4;

    // Bottom accent bar
    doc.setFillColor(...C.primary);
    doc.rect(margin, yPos, contentWidth, 0.8, "F");
    yPos += 6;

    // ══════════════════════════════════════════════════════
    //  1. EXECUTIVE SUMMARY
    // ══════════════════════════════════════════════════════
    drawSectionTitle("Executive Summary");
    checkNewPage(32);

    const rc = riskColor();
    const rb = riskBg();
    const vLabel = verdictLabel();

    // Summary box with soft tint background
    doc.setDrawColor(...rc);
    doc.setLineWidth(0.6);
    doc.setFillColor(...rb);
    doc.roundedRect(margin, yPos, contentWidth, 28, 2, 2, "FD");

    // Verdict badge pill
    doc.setFillColor(...rc);
    doc.roundedRect(margin + 4, yPos + 3, 30, 8, 1.5, 1.5, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.white);
    doc.text(vLabel, margin + 19, yPos + 8.5, { align: "center" });

    // Verdict heading
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.dark);
    doc.text(`Overall Verdict: ${scan.riskLevel} RISK`, margin + 38, yPos + 8.5);

    // Metrics row
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.body);
    doc.text(`Risk Score: ${scan.riskScore}/100`, margin + 6, yPos + 16);
    doc.text(`Confidence: ${scan.confidence}%`, margin + 55, yPos + 16);
    doc.text(`Threat Category: ${scan.threatCategory || "General Phishing"}`, margin + 100, yPos + 16);

    // Summary one-liner
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    const briefSummary = doc.splitTextToSize(scan.summary, contentWidth - 12);
    doc.text(briefSummary[0] + (briefSummary.length > 1 ? "..." : ""), margin + 6, yPos + 23);
    yPos += 34;

    // ══════════════════════════════════════════════════════
    //  2. EMAIL DETAILS
    // ══════════════════════════════════════════════════════
    drawSectionTitle("Email Details");

    const attachCount = scan.attachments ? scan.attachments.length : 0;
    const attachNames = scan.attachments ? scan.attachments.map(a => a.filename).join(", ") : "None";
    const urlCount = scan.urlAnalysis ? scan.urlAnalysis.length : 0;

    const emailRows: [string, string][] = [
      ["Sender",       scan.sender],
      ["Reply-To",     scan.replyTo || "Same as sender"],
      ["Subject",      scan.subject],
      ["Date Analyzed", new Date(scan.createdAt).toLocaleString()],
      ["Recipient",    user?.email || "Current User"],
      ["Attachments",  attachCount > 0 ? `${attachCount} \u2014 ${attachNames}` : "None"],
      ["Links Found",  `${urlCount} URL(s) detected`],
      ["Engine Used",  scan.engine || "Hybrid"],
    ];
    emailRows.forEach(([l, v], i) => drawKVRow(l, v, i % 2 === 0));
    yPos += 4;

    // ══════════════════════════════════════════════════════
    //  3. URL ANALYSIS  (conditional)
    // ══════════════════════════════════════════════════════
    if (scan.urlAnalysis && scan.urlAnalysis.length > 0) {
      drawSectionTitle("URL Analysis");

      const cw = [70, 25, 40, 20, 15];
      drawBorderedTableRow([
        { text: "URL", width: cw[0] }, { text: "PROTOCOL", width: cw[1] },
        { text: "DOMAIN", width: cw[2] }, { text: "HTTPS", width: cw[3] },
        { text: "RISK", width: cw[4] },
      ], true, false);

      scan.urlAnalysis.forEach((u, idx) => {
        let protocol = "HTTP", domain = u.url, isHttps = "No";
        try {
          const p = new URL(u.url);
          protocol = p.protocol.replace(":", "").toUpperCase();
          domain = p.hostname;
          isHttps = p.protocol === "https:" ? "Yes" : "No";
        } catch { /* invalid URL */ }
        drawBorderedTableRow([
          { text: u.url, width: cw[0] }, { text: protocol, width: cw[1] },
          { text: domain, width: cw[2] }, { text: isHttps, width: cw[3] },
          { text: u.classification || "Unknown", width: cw[4] },
        ], false, idx % 2 === 0);
      });

      // Findings detail below table
      scan.urlAnalysis.forEach(u => {
        if (u.reasons && u.reasons.length > 0) {
          checkNewPage(10);
          doc.setFontSize(8);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(...C.muted);
          const tUrl = u.url.length > 60 ? u.url.slice(0, 57) + "..." : u.url;
          doc.text(`Findings for: ${tUrl}`, margin + 2, yPos + 2);
          yPos += 5;
          u.reasons.forEach((r: string) => {
            const rL = doc.splitTextToSize(`  \u2022 ${r}`, contentWidth - 10);
            rL.forEach((ln: string) => { checkNewPage(5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.body); doc.text(ln, margin + 5, yPos + 2); yPos += 4; });
          });
          yPos += 2;
        }
      });
      yPos += 2;
    }

    // ══════════════════════════════════════════════════════
    //  4. THREAT ANALYSIS
    // ══════════════════════════════════════════════════════
    drawSectionTitle("Threat Analysis");
    checkNewPage(40);

    drawProgressBar("Overall Risk Score", scan.riskScore, 100, riskColor(), margin + 3, yPos, 100);
    yPos += 12;
    drawProgressBar("Analysis Confidence", scan.confidence, 100, C.primary, margin + 3, yPos, 100);
    yPos += 12;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.body);
    doc.text("Threat Category:", margin + 3, yPos);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.dark);
    doc.text(scan.threatCategory || "General Phishing", margin + 40, yPos);
    yPos += 7;

    // Score breakdown
    if (scan.scoreBreakdown) {
      yPos += 2;
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.15);
      doc.line(margin, yPos, margin + contentWidth, yPos);
      yPos += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.primary);
      doc.text("Hybrid Score Breakdown", margin + 3, yPos);
      yPos += 7;

      drawProgressBar(`Rule Engine (Weight: ${(scan.scoreBreakdown.weights.rule * 100).toFixed(0)}%)`, scan.scoreBreakdown.rule, 100, C.ruleViolet, margin + 3, yPos, 90);
      yPos += 12;
      drawProgressBar(`ML Model (Weight: ${(scan.scoreBreakdown.weights.ml * 100).toFixed(0)}%)`, scan.scoreBreakdown.ml, 100, C.mlBlue, margin + 3, yPos, 90);
      yPos += 12;
      if (scan.scoreBreakdown.ai !== null) {
        drawProgressBar(`Gemini AI (Weight: ${(scan.scoreBreakdown.weights.ai * 100).toFixed(0)}%)`, scan.scoreBreakdown.ai, 100, C.aiSky, margin + 3, yPos, 90);
        yPos += 12;
      }
    }

    // ML / Rule result details
    if (scan.mlResult || scan.ruleResult) {
      yPos += 2;
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.15);
      doc.line(margin, yPos, margin + contentWidth, yPos);
      yPos += 6;
      if (scan.mlResult) {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.body);
        doc.text(`ML Verdict: ${scan.mlResult.verdict}`, margin + 3, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(`  (Confidence: ${scan.mlResult.confidence}%, Score: ${scan.mlResult.score}/100)`, margin + 42, yPos);
        yPos += 6;
      }
      if (scan.ruleResult) {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.body);
        doc.text(`Rule Engine Score: ${scan.ruleResult.score}/100`, margin + 3, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(`  Category: ${scan.ruleResult.category}  |  Urgency: ${scan.ruleResult.urgency}/10`, margin + 50, yPos);
        yPos += 6;
      }
    }
    yPos += 4;

    // ══════════════════════════════════════════════════════
    //  5. DETECTED INDICATORS
    // ══════════════════════════════════════════════════════
    if (scan.threatVectors && scan.threatVectors.length > 0) {
      drawSectionTitle("Detected Indicators");

      const iw = [55, 30, 30, 55];
      drawBorderedTableRow([
        { text: "INDICATOR", width: iw[0] }, { text: "SEVERITY", width: iw[1] },
        { text: "STATUS", width: iw[2] }, { text: "DESCRIPTION", width: iw[3] },
      ], true, false);

      scan.threatVectors.forEach((v, idx) => {
        const sev = v.type === "critical" ? "CRITICAL" : v.type === "warning" ? "WARNING" : v.type === "info" ? "INFO" : "PASS";
        const sts = v.type === "critical" || v.type === "warning" ? "DETECTED" : "CLEAR";
        drawBorderedTableRow([
          { text: v.title, width: iw[0] }, { text: sev, width: iw[1] },
          { text: sts, width: iw[2] }, { text: v.description, width: iw[3] },
        ], false, idx % 2 === 0);
      });
      yPos += 4;
    }

    // ══════════════════════════════════════════════════════
    //  6. ANALYSIS EXPLANATION
    // ══════════════════════════════════════════════════════
    drawSectionTitle("Analysis Explanation");

    const explTitle = isHighRisk
      ? "Why This Email Is Classified as Phishing"
      : isMediumRisk
      ? "Why This Email Is Classified as Suspicious"
      : "Why This Email Is Classified as Safe";

    checkNewPage(12);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.dark);
    doc.text(explTitle, margin + 3, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.body);
    const explLines = doc.splitTextToSize(scan.summary || "No detailed analysis available.", contentWidth - 6);
    explLines.forEach((ln: string) => { checkNewPage(5); doc.text(ln, margin + 3, yPos); yPos += 4.5; });
    yPos += 4;

    // Key observations from comparison data
    if (scan.comparison) {
      checkNewPage(16);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.dark);
      doc.text("Key Observations", margin + 3, yPos);
      yPos += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.body);
      const obs = [
        `ML Engine Verdict: ${scan.comparison.mlResult.verdict} (Confidence: ${scan.comparison.mlResult.confidence}%)`,
        scan.comparison.aiResult
          ? `AI Engine Verdict: ${scan.comparison.aiResult.verdict} (Confidence: ${scan.comparison.aiResult.confidence}%)`
          : "AI Engine: Not used in this analysis",
        `Engine Agreement: ${scan.comparison.agreement ? "Yes \u2014 Both engines agree" : "No \u2014 Engines disagree"}`,
        `Reasoning: ${scan.comparison.reason}`,
      ];
      obs.forEach(o => {
        const oL = doc.splitTextToSize(`\u2022 ${o}`, contentWidth - 10);
        oL.forEach((ln: string) => { checkNewPage(5); doc.text(ln, margin + 5, yPos); yPos += 4.5; });
      });
      yPos += 4;
    }

    // ══════════════════════════════════════════════════════
    //  7. SECURITY RECOMMENDATIONS
    // ══════════════════════════════════════════════════════
    drawSectionTitle("Security Recommendations");

    recommendations.forEach((rec, idx) => {
      checkNewPage(10);
      // Severity dot
      const dotC = isHighRisk ? C.danger : isMediumRisk ? C.warning : C.success;
      doc.setFillColor(...dotC);
      doc.circle(margin + 5, yPos + 1, 1.5, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.dark);
      const rL = doc.splitTextToSize(`${idx + 1}. ${rec}`, contentWidth - 15);
      rL.forEach((ln: string, li: number) => { if (li > 0) checkNewPage(5); doc.text(ln, margin + 10, yPos + 2); yPos += 5; });
      yPos += 1.5;
    });
    yPos += 4;

    // ══════════════════════════════════════════════════════
    //  8. RISK VISUALIZATION
    // ══════════════════════════════════════════════════════
    drawSectionTitle("Risk Visualization");
    checkNewPage(42);

    const boxW = (contentWidth - 8) / 3;
    const boxH = 30;
    const boxY = yPos;
    const vizMetrics = [
      { label: "Overall Risk",    value: scan.riskScore,                                      max: 100, color: riskColor() },
      { label: "Confidence",      value: scan.confidence,                                     max: 100, color: C.primary },
      { label: "Threat Severity", value: isHighRisk ? 90 : isMediumRisk ? 55 : 20,            max: 100, color: riskColor() },
    ];
    vizMetrics.forEach((m, idx) => {
      const bx = margin + idx * (boxW + 4);
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.roundedRect(bx, boxY, boxW, boxH, 1.5, 1.5, "S");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.muted);
      doc.text(m.label.toUpperCase(), bx + boxW / 2, boxY + 6, { align: "center" });
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...m.color);
      doc.text(`${m.value}`, bx + boxW / 2, boxY + 16, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.light);
      doc.text(`/ ${m.max}`, bx + boxW / 2, boxY + 21, { align: "center" });
      const pbX = bx + 5, pbY2 = boxY + boxH - 6, pbW = boxW - 10, pbH2 = 3;
      doc.setFillColor(...C.primaryLight);
      doc.roundedRect(pbX, pbY2, pbW, pbH2, 1, 1, "F");
      doc.setFillColor(...m.color);
      doc.roundedRect(pbX, pbY2, Math.max(pbW * (m.value / m.max), 2), pbH2, 1, 1, "F");
    });
    yPos = boxY + boxH + 8;

    // ══════════════════════════════════════════════════════
    //  9. ANALYSIS METHODOLOGY
    // ══════════════════════════════════════════════════════
    drawSectionTitle("Analysis Methodology");
    checkNewPage(50);

    const steps = [
      { n: "1", t: "Input Validation",    d: "Email headers, body, and metadata are parsed and validated." },
      { n: "2", t: "Feature Extraction",  d: "Key indicators like URLs, sender reputation, and language patterns are extracted." },
      { n: "3", t: "Rule Engine",         d: "Deterministic rules evaluate known phishing patterns and heuristics." },
      { n: "4", t: "Machine Learning",    d: "TF-IDF vectorized content is classified by the trained ML model." },
      { n: "5", t: "Gemini AI",           d: "Google's Gemini AI provides contextual threat intelligence analysis." },
      { n: "6", t: "Hybrid Decision",     d: "Weighted fusion of all engines produces the final verdict and confidence." },
    ];
    steps.forEach((s, idx) => {
      checkNewPage(14);
      doc.setFillColor(...C.primary);
      doc.circle(margin + 6, yPos + 2.5, 4, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.white);
      doc.text(s.n, margin + 6, yPos + 3.8, { align: "center" });
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.dark);
      doc.text(s.t, margin + 14, yPos + 2);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.muted);
      doc.text(s.d, margin + 14, yPos + 7);
      if (idx < steps.length - 1) {
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.3);
        doc.line(margin + 6, yPos + 6.5, margin + 6, yPos + 12.5);
      }
      yPos += 13;
    });
    yPos += 4;

    // ══════════════════════════════════════════════════════
    //  FOOTER ON ALL PAGES
    // ══════════════════════════════════════════════════════
    const totalPages = doc.getNumberOfPages();
    for (let pg = 1; pg <= totalPages; pg++) {
      doc.setPage(pg);
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 18, margin + contentWidth, pageHeight - 18);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.primary);
      doc.text("KARNAKAVACH", margin, pageHeight - 14);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.light);
      doc.text("Confidential Security Report", pageWidth / 2, pageHeight - 14, { align: "center" });
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 10, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.muted);
      doc.text(`Page ${pg} of ${totalPages}`, margin + contentWidth, pageHeight - 14, { align: "right" });
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.light);
      doc.text(`\u00A9 ${new Date().getFullYear()} KarnaKavach \u2014 All Rights Reserved`, margin + contentWidth, pageHeight - 10, { align: "right" });
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
