import React, { useState, useRef } from "react";
import { Mail, SearchCode, ShieldAlert, Cpu, AlertTriangle, Play, HelpCircle, FileDown, Globe, Sparkles, Image as ImageIcon, X, Link as LinkIcon } from "lucide-react";
import { Scan } from "../types";
import { motion, AnimatePresence } from "motion/react";
import MLFeedbackPanel from "./MLFeedbackPanel";

interface AnalyzerViewProps {
  onScanComplete: (newScan: Scan) => void;
  onRequestOpenSettings?: () => void;
}

export default function AnalyzerView({ onScanComplete, onRequestOpenSettings }: AnalyzerViewProps) {
  const [inputMode, setInputMode] = useState<"fields" | "raw">("fields");
  const [analysisEngine, setAnalysisEngine] = useState<"ai" | "ml">("ai");
  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
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
    let extractedBody = text;

    // Regex for basic EML headers
    const fromMatch = text.match(/^From:\s*(.*)$/mi);
    const subjectMatch = text.match(/^Subject:\s*(.*)$/mi);

    if (fromMatch) {
      extractedSender = fromMatch[1].trim().replace(/[<>]/g, "");
    }
    if (subjectMatch) {
      extractedSubject = subjectMatch[1].trim();
    }

    // Attempt to strip email headers from the final body payload
    const bodyStartIndex = text.indexOf("\n\n");
    if (bodyStartIndex !== -1) {
      extractedBody = text.substring(bodyStartIndex + 2).trim();
    }

    setSender(extractedSender || sender);
    setSubject(extractedSubject || subject);
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
      } else {
        const text = await file.text();
        if (file.name.endsWith(".json")) {
          try {
            const parsed = JSON.parse(text);
            setSender(parsed.sender || parsed.from || "");
            setSubject(parsed.subject || "");
            setBody(parsed.body || parsed.text || text);
          } catch {
            parseEmlContent(text);
          }
        } else {
          parseEmlContent(text);
        }
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
        riskScore: report.riskScore,
        riskLevel: report.riskLevel,
        createdAt: new Date().toISOString(),
        summary: report.summary,
        confidence: report.confidence,
        threatVectors: report.threatVectors,
        engine: analysisEngine === "ai" ? "Gemini AI" : "Machine Learning",
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
           <div className="flex bg-surface-container-high rounded-lg p-1 border border-outline-variant/30">
              <button 
                type="button" 
                onClick={() => setAnalysisEngine("ai")} 
                className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-md transition-all ${analysisEngine === "ai" ? "bg-primary-fixed-dim text-background shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
              >
                AI Analysis (Gemini)
              </button>
              <button 
                type="button" 
                onClick={() => setAnalysisEngine("ml")} 
                className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-md transition-all ${analysisEngine === "ml" ? "bg-indigo-500 text-background shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
              >
                ML Analysis
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
                    rows={7}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-xs text-on-surface font-mono placeholder:text-outline-variant/40 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim/30 transition-all h-40 resize-none"
                  />
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
                              ? "bg-error/15 border-error/25 text-error shadow-[0_0_8px_rgba(255,180,171,0.05)]"
                              : isWarning
                              ? "bg-secondary-container/20 border-secondary/30 text-secondary"
                              : "bg-surface-dim border-outline-variant text-[10px]"
                          }`}>
                            {vector.badge}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Simulated check alert */}
                {results?.isSimulated && (
                  <div className="p-3 bg-surface-container-high/40 rounded-lg flex items-center justify-between gap-3 text-xs border border-outline-variant/30 mt-2">
                    <span className="font-sans text-on-surface-variant font-medium">
                      🤖 Live Gemini scan is in simulated offline demo mode. Enable the real API to get true cyber intelligence!
                    </span>
                    <button
                      type="button"
                      onClick={onRequestOpenSettings}
                      className="text-primary-fixed-dim hover:text-primary underline text-xs shrink-0 cursor-pointer text-[11px] uppercase tracking-wider font-extrabold font-display"
                    >
                      Connect Key
                    </button>
                  </div>
                )}

              </div>

              {/* ML Active Learning Feedback — only shown for ML engine results */}
              {results && analysisEngine === "ml" && (
                <MLFeedbackPanel scan={results} />
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
