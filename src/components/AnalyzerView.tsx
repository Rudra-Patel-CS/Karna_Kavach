import React, { useState, useRef, useEffect } from "react";
import { Mail, SearchCode, ShieldAlert, Cpu, AlertTriangle, FileDown, Sparkles, Image as ImageIcon, X, Link as LinkIcon, Layers, Shield, Target, CheckCircle, ChevronDown, ChevronUp, Globe, FileText, Check, AlertCircle } from "lucide-react";
import { Scan } from "../types";
import { motion, AnimatePresence } from "motion/react";
import MLFeedbackPanel from "./MLFeedbackPanel";
import FeedbackPanel from "./FeedbackPanel";

interface AnalyzerViewProps {
  onScanComplete: (newScan: Scan) => void;
  onRequestOpenSettings?: () => void;
  userId?: string;
}

export default function AnalyzerView({ onScanComplete, onRequestOpenSettings, userId }: AnalyzerViewProps) {
  const [inputMode, setInputMode] = useState<"fields" | "raw">("fields");
  const [analysisEngine, setAnalysisEngine] = useState<"ai" | "ml" | "hybrid">("hybrid");

  useEffect(() => {
    const applySettings = () => {
      const saved = localStorage.getItem("karnakavach_settings");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.defaultEngine) {
            setAnalysisEngine(parsed.defaultEngine);
          }
        } catch {}
      }
    };
    applySettings();
    window.addEventListener("karnakavach_settings_updated", applySettings);
    return () => window.removeEventListener("karnakavach_settings_updated", applySettings);
  }, []);

  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [attachments, setAttachments] = useState<{ filename: string; contentType: string; sizeBytes: number }[]>([]);
  const [rawEmailText, setRawEmailText] = useState("");
  const [imagePayloads, setImagePayloads] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [parsingRaw, setParsingRaw] = useState(false);
  const [results, setResults] = useState<Scan | null>(null);
  const [parsedData, setParsedData] = useState<any>(null); // holds parsed outcome from python
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [analysisDuration, setAnalysisDuration] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Read the Raw EML content when parsing
  const handleParseRawText = async () => {
    if (!rawEmailText.trim()) {
      setErrorMsg("Please paste some raw email text first.");
      return;
    }
    
    setParsingRaw(true);
    setErrorMsg("");
    try {
      const response = await fetch("/api/parse_email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: rawEmailText })
      });
      
      if (!response.ok) {
        throw new Error(await response.text());
      }
      
      const data = await response.json();
      setParsedData(data);
      
      // Auto-fill fields with parsed data
      setSender(data.from_email || data.from_name || "");
      setSubject(data.subject || "");
      setBody(data.body || "");
      setReplyTo(data.reply_to || "");
      setAttachments(data.attachments || []);
      
      if (!data.parsed_successfully) {
        setErrorMsg("Heuristic parsing failed. Entire block treated as email body.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Parsing failed: " + (err.message || "Unknown error"));
    } finally {
      setParsingRaw(false);
    }
  };

  // Parse Raw EML content or plain text fields
  const parseEmlContent = (text: string) => {
    let extractedSender = "";
    let extractedSubject = "";
    let extractedReplyTo = "";
    let extractedBody = text;

    // Regex for basic EML headers
    const fromMatch = text.match(/^From:\s*(.*)$/mi);
    const subjectMatch = text.match(/^Subject:\s*(.*)$/mi);
    const replyToMatch = text.match(/^Reply-To:\s*(.*)$/mi);

    if (fromMatch) {
      extractedSender = fromMatch[1].trim().replace(/[<>]/g, "");
    }
    if (subjectMatch) {
      extractedSubject = subjectMatch[1].trim();
    }
    if (replyToMatch) {
      extractedReplyTo = replyToMatch[1].trim().replace(/[<>]/g, "");
    }

    // Attempt to strip email headers from the final body payload
    const bodyStartIndex = text.indexOf("\n\n");
    if (bodyStartIndex !== -1) {
      extractedBody = text.substring(bodyStartIndex + 2).trim();
    }

    setSender(extractedSender || sender);
    setSubject(extractedSubject || subject);
    setReplyTo(extractedReplyTo || replyTo);
    setBody(extractedBody || body);
  };

  // Drag and drop event handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        handleFileRead(e.dataTransfer.files[i]);
      }
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      for (let i = 0; i < e.target.files.length; i++) {
        handleFileRead(e.target.files[i]);
      }
    }
  };

  const handleFileRead = async (file: File) => {
    setErrorMsg("");
    try {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result && typeof event.target.result === "string") {
            const result = event.target.result;
            setImagePayloads(prev => [...prev, result]);
          }
        };
        reader.readAsDataURL(file);
      } else if (file.name.endsWith(".eml") || file.name.endsWith(".txt") || file.name.endsWith(".json")) {
        const text = await file.text();
        if (file.name.endsWith(".json")) {
          try {
            const parsed = JSON.parse(text);
            setSender(parsed.sender || parsed.from || "");
            setSubject(parsed.subject || "");
            setBody(parsed.body || parsed.text || text);
            setReplyTo(parsed.replyTo || parsed.reply_to || "");
            setAttachments(parsed.attachments || []);
          } catch {
            parseEmlContent(text);
          }
        } else {
          parseEmlContent(text);
        }
      } else {
        const newAttachment = {
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size
        };
        setAttachments(prev => [...prev, newAttachment]);
      }
    } catch {
      setErrorMsg("Failed to read file. Ensure it is a valid text, .eml, .json, or image file.");
    }
  };

  const triggerSearchScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sender && !subject && !body && imagePayloads.length === 0) {
      setErrorMsg("Please specify either email sender, subject, message body, or upload an image to begin scanning.");
      return;
    }

    setAnalyzing(true);
    setErrorMsg("");
    setResults(null);

    try {
      const savedSettingsStr = localStorage.getItem("karnakavach_settings");
      let model = "gemini-2.5-flash";
      let sensitivity = "Medium";
      let autoUrlScan = true;
      let enableOcr = true;
      let language = "English";
      if (savedSettingsStr) {
         try {
           const parsedSettings = JSON.parse(savedSettingsStr);
           if (parsedSettings.model) model = parsedSettings.model;
           if (parsedSettings.sensitivity) sensitivity = parsedSettings.sensitivity;
           if (parsedSettings.autoUrlScan !== undefined) autoUrlScan = parsedSettings.autoUrlScan;
           if (parsedSettings.enableOcr !== undefined) enableOcr = parsedSettings.enableOcr;
           if (parsedSettings.language) language = parsedSettings.language;
         } catch(e) {}
      }

      // Drop images if OCR is disabled
      const effectiveImages = enableOcr ? imagePayloads : [];
      let response;
      let report;
      const startTime = performance.now();

      if (analysisEngine === "ai") {
        response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sender, subject, body, images: effectiveImages, model, sensitivity, autoUrlScan, language }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        report = await response.json();
      } else if (analysisEngine === "hybrid") {
        response = await fetch("/api/hybrid-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender, subject, body, model, sensitivity, language, images: effectiveImages, replyTo, attachments }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const hybridOutput = await response.json();
        report = {
          riskScore:      hybridOutput.riskScore,
          riskLevel:      hybridOutput.riskLevel,
          summary:        hybridOutput.summary,
          confidence:     hybridOutput.confidence,
          threatVectors:  hybridOutput.threatVectors,
          threatCategory: hybridOutput.threatCategory,
          scoreBreakdown: hybridOutput.scoreBreakdown,
          recommendations: hybridOutput.recommendations,
          emailIntel:     hybridOutput.emailIntel,
          mlResult:       hybridOutput.mlResult,
          ruleResult:     hybridOutput.ruleResult,
          urlAnalysis:    hybridOutput.urlAnalyses,
          comparison:     hybridOutput.comparison
        };
      } else {
        response = await fetch("/api/ml-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender, subject, body }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const mlOutput = await response.json();
        
        // Map ML output to UI report format
        const riskLevel = mlOutput.verdict === "Phishing" ? "HIGH" : "LOW";
        report = {
           riskScore: mlOutput.probability,
           riskLevel: riskLevel,
           summary: mlOutput.reasons.join("\n") || `The Local ML model has determined this email is ${mlOutput.verdict} with ${mlOutput.confidence}% confidence.`,
           confidence: mlOutput.confidence,
           threatVectors: mlOutput.reasons.length > 0 ? mlOutput.reasons.map((r:string, i:number) => ({
              title: i===0?"Primary Keyword Driver":"Secondary Findings",
              description: r,
              badge: riskLevel==="HIGH" ? "Trigger" : "Clean",
              type: riskLevel==="HIGH" ? "critical" : "success"
           })) : [{ title: "Analyzed Text", description: "Model found no specific triggering features in the text or urls.", badge: "Clear", type: "success" }]
        };
      }
      
      const durationMs = Math.round(performance.now() - startTime);
      setAnalysisDuration(durationMs);

      const newScan: Scan = {
        id: "scan_" + Date.now(),
        sender: sender || "Anonymous / Unspecified Source",
        subject: subject ? subject : (imagePayloads.length > 0 ? "Image Analysis" : "No Subject Context"),
        body: body ? body : (imagePayloads.length > 0 ? `[${imagePayloads.length} Image payload(s) provided]` : "Plaintext Payload Block"),
        replyTo: replyTo,
        attachments: attachments,
        riskScore: report.riskScore,
        riskLevel: report.riskLevel,
        createdAt: new Date().toISOString(),
        summary: report.summary,
        confidence: report.confidence,
        threatVectors: report.threatVectors,
        engine: analysisEngine === "ai" ? "Gemini AI" : analysisEngine === "hybrid" ? "Hybrid" : "Machine Learning",
        threatCategory: report.threatCategory,
        scoreBreakdown: report.scoreBreakdown,
        recommendations: report.recommendations,
        emailIntel: report.emailIntel,
        mlResult: report.mlResult,
        ruleResult: report.ruleResult,
        urlAnalysis: report.urlAnalysis,
        comparison: report.comparison
      };

      setResults(newScan);
      onScanComplete(newScan);
    } catch (err: any) {
      console.error(err);
      let errorText = err.message || "Cognitive scan engine timed out. Please retry.";
      try {
         const parsedError = JSON.parse(errorText);
         if (parsedError.error) errorText = parsedError.error;
      } catch(e) {}
      setErrorMsg(errorText);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full">
      
      {/* Input panel block - Left col */}
      <div className="xl:col-span-5 flex flex-col gap-6">

        {/* Engine Selection Block */}
        <div className="glass-panel items-center justify-between flex rounded-3xl p-4 px-6 border border-neutral-800">
           <div>
              <h3 className="font-display font-black text-xs uppercase tracking-widest text-[#7df4ff]">Analysis Engine</h3>
              <p className="font-mono text-[10px] text-outline-variant pt-1 uppercase">Select detection model</p>
           </div>
           <div className="flex bg-surface-container-high rounded-lg p-1 border border-outline-variant/30 gap-1">
              <button 
                type="button" 
                onClick={() => setAnalysisEngine("hybrid")} 
                className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-md transition-all flex items-center gap-1 ${analysisEngine === "hybrid" ? "bg-gradient-to-r from-indigo-500 to-primary-fixed-dim text-background shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
              >
                <Layers className="w-3 h-3" />
                Hybrid
              </button>
              <button 
                type="button" 
                onClick={() => setAnalysisEngine("ai")} 
                className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-md transition-all ${analysisEngine === "ai" ? "bg-primary-fixed-dim text-background shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
              >
                AI
              </button>
              <button 
                type="button" 
                onClick={() => setAnalysisEngine("ml")} 
                className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-md transition-all ${analysisEngine === "ml" ? "bg-indigo-500 text-background shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
              >
                ML
              </button>
           </div>
        </div>
        
        {/* Detailed Form or Raw Paste Form */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col gap-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-fixed-dim/55 to-transparent opacity-50" />
          
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display font-black text-xs uppercase tracking-widest text-[#7df4ff] flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary-fixed-dim" />
              Source Data Entry
            </h2>
            <div className="flex bg-surface-container-high rounded-full p-1 border border-outline-variant/30">
              <button 
                type="button" 
                onClick={() => setInputMode("fields")} 
                className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full transition-all ${inputMode === "fields" ? "bg-primary-fixed-dim text-background shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
              >
                Structured
              </button>
              <button 
                type="button" 
                onClick={() => setInputMode("raw")} 
                className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full transition-all flex items-center gap-1 ${inputMode === "raw" ? "bg-primary-fixed-dim text-background shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
              >
                Paste Raw
              </button>
            </div>
          </div>

          <div className="space-y-4">
            
            {inputMode === "fields" ? (
              <>
                {/* Sender Address */}
                <div className="flex flex-col gap-2 group">
                  <label className="font-sans text-[11px] font-bold text-on-surface-variant group-focus-within:text-primary-fixed-dim transition-colors uppercase tracking-wider">
                    Sender Email Address
                  </label>
                  <input
                    type="text"
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    placeholder="e.g., billing@netflix-secure.net"
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-2.5 text-xs text-on-surface font-mono placeholder:text-outline-variant/40 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim/30 transition-all"
                  />
                </div>

                {/* Reply-To Address */}
                <div className="flex flex-col gap-2 group">
                  <label className="font-sans text-[11px] font-bold text-on-surface-variant group-focus-within:text-primary-fixed-dim transition-colors uppercase tracking-wider">
                    Reply-To Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    placeholder="e.g., hacker-controlled@scam-mail.net"
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-2.5 text-xs text-on-surface font-mono placeholder:text-outline-variant/40 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim/30 transition-all"
                  />
                </div>

                {/* Subject Line */}
                <div className="flex flex-col gap-2 group">
                  <label className="font-sans text-[11px] font-bold text-on-surface-variant group-focus-within:text-primary-fixed-dim transition-colors uppercase tracking-wider">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Action Required: Update your credentials"
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-2.5 text-xs text-on-surface font-mono placeholder:text-outline-variant/40 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim/30 transition-all"
                  />
                </div>

                {/* Content Body Payload */}
                <div className="flex flex-col gap-2 group">
                  <label className="font-sans text-[11px] font-bold text-on-surface-variant group-focus-within:text-primary-fixed-dim transition-colors uppercase tracking-wider">
                    Email Payload (Raw or Text)
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Paste the raw body or metadata payload here..."
                    rows={6}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-xs text-on-surface font-mono placeholder:text-outline-variant/40 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim/30 transition-all h-36 resize-none"
                  />
                </div>

                {/* Attachments Section */}
                <div className="flex flex-col gap-2">
                  <label className="font-sans text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Mock Attachments ({attachments.length})
                  </label>
                  {attachments.length > 0 && (
                    <div className="flex flex-col gap-1.5 bg-surface-container-lowest p-3 border border-outline-variant/20 rounded-lg max-h-40 overflow-y-auto">
                      {attachments.map((att, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs font-mono bg-surface-container-low p-2 rounded border border-outline-variant/10">
                          <div className="truncate pr-4 flex items-center gap-1.5 text-on-surface">
                            <span className="font-bold text-[8px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded uppercase">
                              {att.filename.split('.').pop() || 'file'}
                            </span>
                            <span className="truncate max-w-[150px]">{att.filename}</span>
                            <span className="text-[9px] text-outline-variant">({(att.sizeBytes / 1024).toFixed(1)} KB)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-500 p-1 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.onchange = (e) => {
                        const files = (e.target as HTMLInputElement).files;
                        if (files && files.length > 0) {
                          handleFileRead(files[0]);
                        }
                      };
                      input.click();
                    }}
                    className="text-[10px] text-indigo-400 font-bold hover:underline self-start flex items-center gap-1 uppercase tracking-wider"
                  >
                    + Add Mock Attachment File
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 group">
                  <label className="font-sans text-[11px] font-bold text-on-surface-variant group-focus-within:text-primary-fixed-dim transition-colors uppercase tracking-wider">
                    Paste Entire Email View Source or Text
                  </label>
                  <textarea
                    value={rawEmailText}
                    onChange={(e) => setRawEmailText(e.target.value)}
                    placeholder="Paste headers, body, email source (.eml text), or a massive copy block..."
                    rows={12}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-xs text-on-surface font-mono placeholder:text-outline-variant/40 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim/30 transition-all h-64 resize-none"
                  />
                </div>
                
                <button
                  type="button"
                  onClick={handleParseRawText}
                  disabled={parsingRaw}
                  className="bg-surface-container-high hover:bg-surface-dim border border-outline-variant/40 text-on-surface text-xs font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 uppercase tracking-wide disabled:opacity-50"
                >
                  {parsingRaw ? (
                    <span className="w-4 h-4 border-2 border-on-surface border-t-transparent rounded-full animate-spin" />
                  ) : <SearchCode className="w-4 h-4" />}
                  Extract Information Structure
                </button>

                {parsedData && (
                  <div className="mt-2 bg-surface-container/30 border border-primary-fixed-dim/30 rounded-xl p-4 flex flex-col gap-3">
                    <h3 className="font-display font-black text-[10px] text-primary-fixed-dim uppercase tracking-widest flex items-center gap-2">
                      <SearchCode className="w-3.5 h-3.5" />
                      Extracted Data Preview
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      <div className="col-span-2 md:col-span-1">
                        <span className="text-outline-variant block mb-0.5 text-[9px] uppercase tracking-wider">Sender</span>
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-200 truncate block">{parsedData.from_name ? `${parsedData.from_name} <${parsedData.from_email}>` : parsedData.from_email || "N/A"}</span>
                          {parsedData.confidence_scores?.from_email > 0 && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 rounded">{(parsedData.confidence_scores.from_email * 100).toFixed(0)}% Conf</span>}
                        </div>
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <span className="text-outline-variant block mb-0.5 text-[9px] uppercase tracking-wider">Date</span>
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-200 truncate block">{parsedData.date || "N/A"}</span>
                          {parsedData.confidence_scores?.date > 0 && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 rounded">{(parsedData.confidence_scores.date * 100).toFixed(0)}% Conf</span>}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-outline-variant block mb-0.5 text-[9px] uppercase tracking-wider">Subject</span>
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-200 truncate block">{parsedData.subject || "N/A"}</span>
                          {parsedData.confidence_scores?.subject > 0 && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 rounded">{(parsedData.confidence_scores.subject * 100).toFixed(0)}% Conf</span>}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-outline-variant block mb-0.5 text-[9px] uppercase tracking-wider">Body Preview</span>
                        <div className="flex items-center gap-2 mb-1">
                          {parsedData.confidence_scores?.body > 0 && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 rounded">{(parsedData.confidence_scores.body * 100).toFixed(0)}% Conf</span>}
                        </div>
                        <span className="text-neutral-400 truncate block max-h-12 whitespace-pre-wrap overflow-hidden">{parsedData.body ? parsedData.body.substring(0, 100) + "..." : "N/A"}</span>
                      </div>
                      <div className="col-span-2 flex items-center gap-2 text-indigo-400">
                        <LinkIcon className="w-3 h-3" />
                        <span>{parsedData.urls?.length || 0} Links Detected</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Drag & Drop area */}
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`glass-panel rounded-3xl p-6 border-dashed border-2 transition-all duration-300 flex flex-col items-center justify-center text-center gap-3 cursor-pointer group ${
            dragActive 
              ? "border-primary-fixed-dim bg-primary-container/5 scale-[1.01]" 
              : "bg-surface-container/10 border-neutral-800 hover:border-indigo-500/40 hover:bg-neutral-900/40"
          }`}
        >
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileInput}
            accept=".eml,.txt,.json,.msg,image/*"
            className="hidden"
          />
          <div className="w-12 h-12 rounded-full bg-surface-container-high/60 flex items-center justify-center border border-outline-variant/40 group-hover:bg-primary-container/10 transition-colors">
            <FileDown className="w-5 h-5 text-outline group-hover:text-primary-fixed-dim transition-colors" />
          </div>
          <div>
            <h3 className="font-sans font-extrabold text-sm text-on-surface">Ingest EML, MSG, or Screenshots</h3>
            <p className="font-sans text-xs text-on-surface-variant/85 mt-0.5">Drag & drop or click to ingest</p>
          </div>
          <span className="font-mono text-[10px] text-outline-variant uppercase tracking-wider">
            Supported structures: .eml, .txt, .json, images (PNG/JPG)
          </span>
        </div>

        {/* Image Preview */}
        {imagePayloads.length > 0 && (
          <div className="glass-panel p-4 rounded-3xl border border-neutral-800 relative">
            <button 
              type="button" 
              onClick={() => setImagePayloads([])}
              className="absolute top-2 right-2 w-6 h-6 bg-surface-dim rounded-full flex items-center justify-center border border-outline-variant/20 hover:bg-error-container hover:text-error transition-colors z-10"
              title="Clear all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-3 mb-3">
              <ImageIcon className="w-4 h-4 text-primary-fixed-dim" />
              <h3 className="font-sans text-xs font-bold text-on-surface uppercase tracking-wider">Attached Screenshots ({imagePayloads.length})</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {imagePayloads.map((payload, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden border border-outline-variant/10 bg-surface-container-lowest shrink-0 max-h-48 group">
                  <button 
                    type="button" 
                    onClick={() => setImagePayloads(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center border border-white/20 text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-error-container hover:border-error hover:text-error"
                    title="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <img src={payload} alt={`Screenshot ${idx + 1}`} className="h-48 w-auto object-contain" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button Trigger */}
        <button
          onClick={triggerSearchScan}
          disabled={analyzing}
          className="w-full bg-primary-fixed-dim hover:bg-primary-fixed text-background py-4 rounded-xl font-display font-black text-xs tracking-widest uppercase shadow-[0_0_20px_rgba(0,219,233,0.25)] hover:shadow-[0_0_30px_rgba(0,219,233,0.45)] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 disabled:cursor-wait"
        >
          {analyzing ? (
            <>
              <span className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
              ANALYZING EMAIL SIGNATURES...
            </>
          ) : (
            <>
              <Cpu className="w-4 h-4" />
              INITIATE COGNITIVE SCAN
            </>
          )}
        </button>

        {/* Local validation warning errors */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-error-container/20 border border-error/30 text-error p-4 rounded-xl flex gap-3 text-xs font-mono"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <div>{errorMsg}</div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Results output panel col - Right col */}
      <div className="xl:col-span-7 flex flex-col gap-6">
        <AnimatePresence mode="wait">
          {!analyzing && !results ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass-panel rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-4 flex-1 border border-neutral-800/65 min-h-[460px]"
            >
              <div className="w-16 h-16 rounded-full bg-surface-container-high/30 flex items-center justify-center border border-neutral-800">
                <SearchCode className="w-8 h-8 text-neutral-500 animate-pulse" />
              </div>
              <div className="max-w-sm">
                <h3 className="font-sans font-extrabold text-sm uppercase text-neutral-100 mb-1">
                  Ready for Assessment
                </h3>
                <p className="font-sans text-xs text-neutral-400 leading-relaxed">
                  Enter email address specs or upload any standard header format above, then click **Cognitive Scan** to launch evaluation.
                </p>
              </div>
            </motion.div>
          ) : analyzing ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass-panel rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-6 flex-1 min-h-[460px] relative overflow-hidden"
            >
              {/* Circular running pulse scan animation */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-primary-fixed-dim/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border border-primary-fixed-dim/40 animate-pulse" />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className="absolute inset-4 rounded-full border-t border-r border-primary-fixed-dim"
                />
                <Cpu className="w-10 h-10 text-primary-fixed-dim drop-shadow-[0_0_10px_rgba(0,219,233,0.5)]" />
              </div>
              <div className="max-w-sm space-y-2">
                <h3 className="font-display font-black text-xs uppercase tracking-widest text-primary-fixed-dim">
                  Scanning Communication Cords
                </h3>
                <p className="font-mono text-[10px] text-outline uppercase tracking-wider animate-pulse">
                  Evaluating payload linguistics, urgency hooks, & domain spoof patterns...
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 flex-1"
            >
              
              {/* Score card + Explanation card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Score donut card */}
                <div className={`glass-panel rounded-3xl p-6 flex flex-col items-center justify-center relative overflow-hidden ${
                  results!.riskScore >= 70 ? "border border-error/50" : "border border-neutral-800"
                }`}>
                  <div className="absolute top-4 right-4 p-1">
                    <ShieldAlert className={`w-5 h-5 ${results!.riskScore >= 70 ? "text-error" : "text-indigo-400"}`} />
                  </div>
                  
                  <h3 className="font-display font-black text-[10px] text-neutral-400 uppercase tracking-widest self-start mb-4">
                    Cognitive Threat Score
                  </h3>

                  {/* Circular threat progress indicator */}
                  <div className="relative w-44 h-44 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#122131" strokeWidth="6" />
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="42" 
                        fill="none" 
                        stroke={results!.riskScore >= 70 ? "#ffb4ab" : "#00dbe9"} 
                        strokeWidth="6" 
                        strokeDasharray={263.89}
                        strokeDashoffset={263.89 - (263.89 * results!.riskScore) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>

                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className={`font-display text-4xl font-extrabold tracking-tight ${
                        results!.riskScore >= 70 ? "text-error drop-shadow-[0_0_10px_rgba(255,180,171,0.45)]" : "text-primary-fixed-dim drop-shadow-[0_0_10px_rgba(0,219,233,0.4)]"
                      }`}>
                        {results!.riskScore}
                      </span>
                      <span className="font-mono text-[10px] text-outline mt-[-4px]">/100</span>
                    </div>
                  </div>

                  {/* High Threat Tag Badge */}
                  <div className={`mt-5 px-4 py-1 rounded-full border flex items-center gap-2 ${
                    results!.riskScore >= 70 
                      ? "bg-error-container/20 border-error/30 text-error shadow-[0_0_15px_rgba(255,180,171,0.1)]" 
                      : results!.riskScore >= 35
                      ? "bg-secondary-container/20 border-secondary/30 text-secondary"
                      : "bg-primary-container/5 border-primary-fixed-dim/20 text-primary-fixed-dim"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                      results!.riskScore >= 70 ? "bg-error" : results!.riskScore >= 35 ? "bg-secondary" : "bg-primary-fixed-dim"
                    }`} />
                    <span className="font-display font-extrabold text-[9px] tracking-widest uppercase">
                      {results!.riskScore >= 70 ? "CRITICAL PHISHING DETECTED" : results!.riskScore >= 35 ? "SUSPICIOUS THREAT SUSPECT" : "PROVABLY SECURE BASELINE"}
                    </span>
                  </div>

                </div>

                {/* AI Explanation Summary */}
                <div className="glass-panel rounded-3xl p-6 flex flex-col relative justify-between overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 blur-2xl rounded-full" />
                  
                  <div>
                    <h3 className="font-display font-black text-[10px] text-neutral-400 uppercase tracking-widest flex items-center justify-between gap-2 mb-4">
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" style={{ animationDuration: '6s' }} />
                        SYNTHETIC INTELLIGENCE SUMMARY
                      </span>
                      {results!.engine && (
                         <span className={`px-2 py-0.5 rounded font-bold border ${results!.engine === "Gemini AI" ? "bg-primary-container/10 border-primary-fixed-dim text-primary-fixed-dim" : "bg-indigo-500/20 border-indigo-500/50 text-indigo-400"}`}>
                           {results!.engine}
                         </span>
                      )}
                    </h3>
                    
                    <p className="font-sans text-xs text-on-surface leading-relaxed whitespace-pre-line max-h-56 overflow-y-auto pr-1">
                      {results!.summary}
                    </p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-outline-variant/20 flex justify-between items-center font-mono text-[10px]">
                    <span className="text-outline uppercase tracking-wider">Engine Confidence</span>
                    <span className="text-primary-fixed-dim font-bold">{results!.confidence}%</span>
                  </div>
                  {analysisDuration && (
                     <div className="mt-1 flex justify-between items-center font-mono text-[10px]">
                        <span className="text-outline uppercase tracking-wider">Analysis Duration</span>
                        <span className="text-neutral-400 font-bold">{analysisDuration}ms</span>
                     </div>
                  )}

                </div>

              </div>

              {/* Threat structural vector breakdowns */}
              <div className="glass-panel rounded-3xl p-6 flex flex-col gap-5 border border-neutral-800">
                <h3 className="font-display font-black text-[10px] text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-outline" />
                  THREAT VECTOR BREAKDOWN
                </h3>

                <div className="flex flex-col gap-4">
                  {results!.threatVectors.map((vector, index) => {
                    const isCritical = vector.type === "critical" || results!.riskScore >= 70 && index === 0;
                    const isWarning = vector.type === "warning" || vector.type === "critical";

                    return (
                      <div 
                        key={index} 
                        className="bg-surface-container-lowest/40 border border-outline-variant/15 rounded-lg p-4 flex flex-col md:flex-row gap-4 md:items-center justify-between"
                      >
                        <div className="flex items-start md:items-center gap-4">
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${
                            isCritical 
                              ? "bg-error-container/10 border-error/30 text-error" 
                              : isWarning 
                              ? "bg-secondary-container/10 border-secondary/35 text-secondary" 
                              : "bg-primary-container/5 border-primary-fixed-dim/20 text-primary-fixed-dim"
                          }`}>
                            {isCritical ? (
                              <ShieldAlert className="w-5 h-5" />
                            ) : (
                              <SearchCode className="w-5 h-5" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <h4 className="font-sans font-extrabold text-sm text-on-surface">{vector.title}</h4>
                            <p className="font-sans text-xs text-outline mt-0.5 leading-relaxed">{vector.description}</p>
                          </div>

                        </div>

                        <div className="flex-shrink-0 self-end md:self-center">
                          <span className={`px-2.5 py-1 rounded font-mono text-[10px] uppercase font-bold border ${
                            isCritical
                              ? "bg-error/15 border-error/25 text-error"
                              : isWarning
                              ? "bg-secondary-container/20 border-secondary/30 text-secondary"
                              : "bg-surface-dim border-outline-variant text-outline"
                          }`}>
                            {vector.badge}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hybrid extras — only shown for Hybrid engine */}
              {results && results.engine === "Hybrid" && (
                <HybridResultExtras scan={results} />
              )}

              {/* ML Active Learning Feedback — only shown for ML engine results */}
              {results && analysisEngine === "ml" && (
                <MLFeedbackPanel scan={results} />
              )}

              {/* Universal Feedback Panel */}
              {results && userId && (
                <FeedbackPanel scan={results} userId={userId} />
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}

// ── HybridResultExtras ────────────────────────────────────────────────────────
// Extra panels shown after a Hybrid analysis:
// Score breakdown, threat category, engine agreement, recommendations, rule detail.

function HybridResultExtras({ scan }: { scan: import("../types").Scan }) {
  const [showRules, setShowRules] = React.useState(false);

  const sb    = scan.scoreBreakdown;
  const ml    = scan.mlResult;
  const rule  = scan.ruleResult;
  const recs  = scan.recommendations ?? [];
  const cat   = scan.threatCategory ?? "General Phishing";
  const intel = scan.emailIntel ?? {};
  const urls  = scan.urlAnalysis ?? [];
  const comparison = scan.comparison;
  const attachments = scan.attachments ?? [];

  const catStyles: Record<string, string> = {
    "Credential Theft":           "text-rose-400 border-rose-500/35 bg-rose-500/10 shadow-[0_0_10px_rgba(244,63,94,0.15)]",
    "Business Email Compromise":  "text-pink-400 border-pink-500/35 bg-pink-500/10 shadow-[0_0_10px_rgba(236,72,153,0.15)]",
    "Bank Scam":                  "text-amber-400 border-amber-500/35 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.15)]",
    "Delivery Scam":              "text-purple-400 border-purple-500/35 bg-purple-500/10 shadow-[0_0_10px_rgba(168,85,247,0.15)]",
    "Lottery Scam":               "text-yellow-400 border-yellow-500/35 bg-yellow-500/10 shadow-[0_0_10px_rgba(234,179,8,0.15)]",
    "Invoice Scam":               "text-orange-400 border-orange-500/35 bg-orange-500/10 shadow-[0_0_10px_rgba(249,115,22,0.15)]",
    "Crypto Scam":                "text-cyan-400 border-cyan-500/35 bg-cyan-500/10 shadow-[0_0_10px_rgba(6,182,212,0.15)]",
    "Technical Support Scam":     "text-red-400 border-red-500/35 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.15)]",
    "General Phishing":           "text-primary-fixed-dim border-primary-fixed-dim/30 bg-primary-container/10 shadow-[0_0_10px_rgba(0,219,233,0.15)]",
  };
  const catClass = catStyles[cat] ?? catStyles["General Phishing"];

  const compAgree = comparison ? comparison.agreement : true;
  const compReason = comparison ? comparison.reason : "";
  const mlResult = comparison ? comparison.mlResult : null;
  const aiResult = comparison ? comparison.aiResult : null;

  return (
    <div className="space-y-6">

      {/* Row 1: Threat Category + Score Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Threat Category Card */}
        <div className="glass-panel rounded-3xl p-6 border border-neutral-800 flex flex-col gap-4 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-rose-500 to-transparent" />
          <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-neutral-400 flex items-center gap-2">
            <Target className="w-4 h-4 text-rose-400" />
            Classified Threat Vector
          </h3>
          <div className="space-y-2">
            <div className={`px-4 py-2.5 rounded-xl border font-display font-black text-sm uppercase tracking-wider w-fit ${catClass}`}>
              {cat}
            </div>
            <p className="font-sans text-[11px] text-outline-variant leading-relaxed pt-1">
              Deterministic rules combined with semantic models mapped this threat profile to {cat}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant/15 text-[10px] font-mono">
            {intel.urgency_score > 0 && (
              <span className="bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-amber-400">Urgency: {intel.urgency_score}/10</span>
            )}
            {intel.credential_request && (
              <span className="bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded text-rose-400">Credential Harvest</span>
            )}
            {intel.sender_mismatch && (
              <span className="bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-amber-400">Reply-To Mismatch</span>
            )}
            {intel.brand_detected && (
              <span className="bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded text-rose-400">Brand Spoof ({intel.brand_detected})</span>
            )}
          </div>
        </div>

        {/* Score Breakdown Card */}
        {sb && (
          <div className="glass-panel rounded-3xl p-6 border border-neutral-800 flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-indigo-500 to-transparent" />
            <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" /> Score Weights breakdown
            </h3>
            <div className="space-y-3 flex-1 justify-center flex flex-col">
              {[
                { label: "Rule Heuristics", score: sb.rule,     weight: sb.weights.rule, color: "bg-amber-500", glow: "shadow-[0_0_10px_rgba(245,158,11,0.5)]" },
                { label: "ML Classification",    score: sb.ml,       weight: sb.weights.ml,   color: "bg-indigo-500", glow: "shadow-[0_0_10px_rgba(99,102,241,0.5)]" },
                { label: "Gemini AI Core",   score: sb.ai ?? 0,  weight: sb.weights.ai,   color: "bg-primary-fixed-dim", na: sb.ai === null, glow: "shadow-[0_0_10px_rgba(0,219,233,0.5)]" },
              ].map(({ label, score, weight, color, na, glow }) => (
                <div key={label}>
                  <div className="flex justify-between text-[11px] font-mono mb-1.5">
                    <span className="text-outline-variant">{label} <span className="text-outline text-[9px]">({weight}%)</span></span>
                    <span className={na ? "text-outline-variant" : "text-on-surface font-black"}>
                      {na ? "unavailable" : `${score}/100`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                    <div className={`h-full ${color} ${glow} transition-all duration-1000 ease-out ${na ? "opacity-20" : ""}`}
                      style={{ width: na ? "0%" : `${score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Row 2: AI vs ML Comparison Matrix */}
      {(mlResult || aiResult) && (
        <div className="glass-panel rounded-3xl p-6 border border-neutral-800 flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-3xl rounded-full" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/15 pb-3">
            <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-[#7df4ff] flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary-fixed-dim" />
              AI vs ML Engine Duel Matrix
            </h3>
            <span className={`px-3 py-1 rounded-full font-mono text-[9px] uppercase font-black border tracking-wider self-start sm:self-center ${
              compAgree
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            }`}>
              {compAgree ? "ENGINES IN AGREEMENT" : "ENGINE DISCREPANCY DETECTED"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
            {/* ML Column */}
            {mlResult && (
              <div className="bg-surface-container-lowest/40 border border-outline-variant/10 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="font-display font-black text-[9px] uppercase tracking-wider text-outline block mb-2">Local Machine Learning</span>
                  <div className="flex items-baseline gap-2">
                    <span className={`font-display font-black text-lg uppercase ${mlResult.verdict === "Phishing" ? "text-error" : "text-emerald-400"}`}>
                      {mlResult.verdict}
                    </span>
                    <span className="font-mono text-xs text-outline-variant">({mlResult.confidence}% Confidence)</span>
                  </div>
                </div>
                {mlResult.reasons && mlResult.reasons.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-outline-variant/10">
                    <span className="font-sans text-[10px] text-outline block mb-1 uppercase tracking-wider font-bold">Key Model Signals:</span>
                    <ul className="list-none space-y-1 font-mono text-[10px] text-on-surface-variant">
                      {mlResult.reasons.slice(0, 3).map((r, i) => (
                        <li key={i} className="truncate">• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* AI Column */}
            {aiResult ? (
              <div className="bg-surface-container-lowest/40 border border-outline-variant/10 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="font-display font-black text-[9px] uppercase tracking-wider text-outline block mb-2">Cognitive AI Studio Core</span>
                  <div className="flex items-baseline gap-2">
                    <span className={`font-display font-black text-lg uppercase ${aiResult.verdict === "Phishing" ? "text-error" : "text-emerald-400"}`}>
                      {aiResult.verdict}
                    </span>
                    <span className="font-mono text-xs text-outline-variant">({aiResult.confidence}% Confidence)</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-outline-variant/10">
                  <span className="font-sans text-[10px] text-outline block mb-1 uppercase tracking-wider font-bold">Linguistic Summary:</span>
                  <p className="font-sans text-[11px] text-on-surface-variant leading-relaxed line-clamp-3">
                    {aiResult.summary || "No description provided."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-surface-container-lowest/10 border border-outline-variant/5 rounded-2xl p-4 flex items-center justify-center text-center">
                <span className="font-mono text-xs text-outline-variant uppercase">Gemini AI Studio unavailable in local offline mode</span>
              </div>
            )}
          </div>

          <div className="bg-surface-container-low/50 border border-outline-variant/10 rounded-xl p-4 text-xs leading-relaxed text-on-surface-variant font-sans">
            <span className="font-display font-black text-[10px] text-on-surface uppercase tracking-wider block mb-1">Comparative Verdict Reason:</span>
            {compReason || "No comparative reasons generated."}
          </div>
        </div>
      )}

      {/* Row 3: Email Intelligence Inspector */}
      {Object.keys(intel).length > 0 && (
        <div className="glass-panel rounded-3xl p-6 border border-neutral-800 flex flex-col gap-4 relative overflow-hidden">
          <h3 className="font-display font-black text-xs uppercase tracking-widest text-[#7df4ff] flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary-fixed-dim" />
            Advanced Email Intelligence Inspector
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            {[
              { label: "Sender Name", value: intel.sender_name || "Unknown", highlight: false },
              { label: "Sender Domain", value: intel.sender_domain || "Unknown", highlight: false },
              { label: "Reply-To Header", value: intel.reply_to || "Not Configured", highlight: intel.sender_mismatch, isCode: true },
              { label: "Subject Line", value: intel.subject || "No Subject", highlight: false },
              { label: "Payload Length", value: `${intel.email_length || 0} chars`, highlight: false },
              { label: "URLs Extracted", value: `${intel.url_count || 0} link(s)`, highlight: intel.url_count > 5 },
              { label: "Suspicious Words", value: `${intel.suspicious_keyword_count || 0} matches`, highlight: intel.suspicious_keyword_count > 2 },
              { label: "Impersonation", value: intel.brand_detected ? `Spoofs ${intel.brand_detected}` : "None Detected", highlight: !!intel.brand_detected },
            ].map(({ label, value, highlight, isCode }) => (
              <div key={label} className="bg-surface-container-lowest/30 border border-outline-variant/10 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-outline text-[9px] uppercase tracking-wider">{label}</span>
                <span className={`text-xs font-mono font-bold truncate block ${
                  highlight 
                    ? "text-rose-400" 
                    : isCode 
                    ? "text-indigo-400" 
                    : "text-on-surface"
                }`}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-outline-variant/15 pt-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/15">
              <span className="text-[10px] text-outline uppercase tracking-wider font-bold">Sender Trust:</span>
              <span className={`font-mono text-xs font-black uppercase ${
                intel.sender_trust === "High" ? "text-emerald-400" : intel.sender_trust === "Medium" ? "text-amber-400" : "text-rose-400"
              }`}>{intel.sender_trust || "Medium"}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/15">
              <span className="text-[10px] text-outline uppercase tracking-wider font-bold">Subject Threat:</span>
              <span className={`font-mono text-xs font-black uppercase ${
                intel.subject_risk === "High" ? "text-rose-400" : intel.subject_risk === "Medium" ? "text-amber-400" : "text-emerald-400"
              }`}>{intel.subject_risk || "Low"}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/15">
              <span className="text-[10px] text-outline uppercase tracking-wider font-bold">Body Threat:</span>
              <span className={`font-mono text-xs font-black uppercase ${
                intel.body_risk === "High" ? "text-rose-400" : intel.body_risk === "Medium" ? "text-amber-400" : "text-emerald-400"
              }`}>{intel.body_risk || "Low"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Row 4: URL Intelligence details */}
      {urls.length > 0 && (
        <div className="glass-panel rounded-3xl p-6 border border-neutral-800 flex flex-col gap-4 relative overflow-hidden">
          <h3 className="font-display font-black text-xs uppercase tracking-widest text-[#7df4ff] flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary-fixed-dim" />
            Embedded URL Intelligence Matrix
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/20 text-outline text-[9px] uppercase tracking-wider">
                  <th className="py-2.5 pr-2">Link Target</th>
                  <th className="py-2.5 px-2">Domain</th>
                  <th className="py-2.5 px-2">Subdomain</th>
                  <th className="py-2.5 px-2">SSL/HTTPS</th>
                  <th className="py-2.5 px-2">IP/Port</th>
                  <th className="py-2.5 px-2 text-right">Risk Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {urls.map((u: any, idx: number) => {
                  const isHigh = u.risk_score >= 70;
                  const isSusp = u.risk_score >= 40 && u.risk_score < 70;
                  
                  return (
                    <tr key={idx} className="hover:bg-surface-container-low/40 transition-colors">
                      <td className="py-3 pr-2 font-mono text-[10px] text-indigo-400 max-w-[150px] truncate" title={u.url}>
                        {u.url}
                      </td>
                      <td className="py-3 px-2 text-on-surface truncate max-w-[120px]">{u.domain || "N/A"}</td>
                      <td className="py-3 px-2 text-outline-variant truncate max-w-[100px]">{u.subdomain || "none"}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                          u.https 
                            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" 
                            : "bg-rose-500/10 border-rose-500/25 text-rose-400"
                        }`}>
                          {u.https ? "HTTPS Secure" : "HTTP Unsafe"}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-outline-variant">
                        {u.ip ? `${u.ip}:${u.port}` : `dns:${u.port}`}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={`font-black ${
                          isHigh ? "text-error" : isSusp ? "text-amber-400" : "text-emerald-400"
                        }`}>
                          {u.risk_score}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Row 5: Attachment Security Inspector */}
      {attachments.length > 0 && (
        <div className="glass-panel rounded-3xl p-6 border border-neutral-800 flex flex-col gap-4 relative overflow-hidden">
          <h3 className="font-display font-black text-xs uppercase tracking-widest text-[#7df4ff] flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-fixed-dim" />
            Payload Attachment Security Inspector
          </h3>
          <div className="flex flex-col gap-3">
            {attachments.map((att, idx) => {
              const filename = att.filename.toLowerCase();
              const ext = filename.split('.').pop() || '';
              const dangerous_exts = ["exe", "scr", "bat", "vbs", "js", "lnk", "docm", "xlsm", "msi", "ps1", "cab"];
              const archive_exts = ["zip", "rar", "7z", "tar", "gz"];
              
              let risk = "Low Risk";
              let badgeStyle = "bg-emerald-500/10 border-emerald-500/25 text-emerald-400";
              
              if (dangerous_exts.includes(ext)) {
                risk = "Critical Malware Risk";
                badgeStyle = "bg-rose-500/15 border-rose-500/35 text-rose-400 animate-pulse";
              } else if (archive_exts.includes(ext)) {
                risk = "Suspicious Zip Archive";
                badgeStyle = "bg-amber-500/15 border-amber-500/30 text-amber-400";
              } else if (["pdf", "docx", "xlsx", "html"].includes(ext) && 
                         (filename.includes("invoice") || filename.includes("receipt") || filename.includes("bill") || filename.includes("payment"))) {
                risk = "Suspicious Invoice spoof";
                badgeStyle = "bg-rose-500/10 border-rose-500/25 text-rose-400";
              }

              return (
                <div key={idx} className="bg-surface-container-lowest/30 border border-outline-variant/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/35 text-indigo-400 rounded-xl flex items-center justify-center font-display font-black text-xs uppercase tracking-wider shrink-0">
                      {ext}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs text-on-surface font-bold font-sans block truncate max-w-[280px]">{att.filename}</span>
                      <span className="text-[10px] text-outline-variant font-mono">Size: {(att.sizeBytes / 1024).toFixed(1)} KB | Content: {att.contentType || "binary"}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-xl border font-mono text-[9px] uppercase font-black tracking-wider w-fit shrink-0 sm:self-center ${badgeStyle}`}>
                    {risk}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recs.length > 0 && (
        <div className="glass-panel rounded-3xl p-6 border border-neutral-800 flex flex-col gap-4">
          <h3 className="font-display font-black text-xs uppercase tracking-widest text-[#7df4ff] flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" /> Actionable Mitigation Recommendations
          </h3>
          <div className="flex flex-col gap-3">
            {recs.map((rec: string, i: number) => (
              <div key={i} className="flex items-start gap-3.5 p-4 bg-surface-container-low/40 rounded-xl border border-outline-variant/10">
                <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" style={{ strokeWidth: 3 }} />
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rule Engine Detail (collapsible) */}
      {rule?.triggered?.length > 0 && (
        <div className="glass-panel rounded-3xl border border-neutral-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowRules(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4.5 hover:bg-surface-container-low/30 transition-colors"
          >
            <span className="font-display font-black text-xs uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <SearchCode className="w-4 h-4 text-amber-400" />
              Rule Heuristics details ({rule.triggered.length} Indicators Found, Score: {rule.score}/100)
            </span>
            {showRules
              ? <ChevronUp className="w-4 h-4 text-outline-variant" />
              : <ChevronDown className="w-4 h-4 text-outline-variant" />}
          </button>
          {showRules && (
            <div className="px-6 pb-6 flex flex-col gap-3">
              {rule.triggered.map((r: any, i: number) => (
                <div key={i} className={`flex items-start gap-4 p-4 rounded-xl border text-xs leading-relaxed ${
                  r.severity === "critical" ? "border-rose-500/25 bg-rose-500/5 text-rose-200"
                  : r.severity === "high"   ? "border-amber-500/25 bg-amber-500/5 text-amber-200"
                  : r.severity === "medium" ? "border-yellow-500/25 bg-yellow-500/5 text-yellow-200"
                  : "border-outline-variant/15 bg-surface-container-low/20 text-neutral-200"
                }`}>
                  <span className={`font-mono font-black shrink-0 uppercase text-[9px] mt-0.5 px-2 py-0.5 rounded border tracking-wider ${
                    r.severity === "critical" ? "border-rose-500/50 text-rose-400"
                    : r.severity === "high"   ? "border-amber-500/50 text-amber-400"
                    : r.severity === "medium" ? "border-yellow-500/50 text-yellow-400"
                    : "border-outline-variant text-outline-variant"
                  }`}>{r.severity}</span>
                  <div>
                    <p className="font-display font-black text-[10px] uppercase tracking-wider text-on-surface">{r.rule.replace(/_/g, " ")}</p>
                    <p className="text-on-surface-variant mt-1">{r.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
