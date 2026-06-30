import express from "express";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load .env.local first, then fall back to .env
dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
app.use(express.json({ limit: "50mb" }));

const PORT = 3000;

// Detect python command (python on Windows, python3 on Unix)
const PYTHON_CMD = process.platform === "win32" ? "python" : "python3";

// Parse Raw Email API (Calls python parsing script)
app.post("/api/parse_email", (req, res) => {
  const { rawText } = req.body;
  if (!rawText) {
    return res.status(400).json({ error: "Missing raw text." });
  }

  const scriptPath = path.join(process.cwd(), "karnakavach_backend", "parse_cli.py");
  
  if (!fs.existsSync(scriptPath)) {
    return res.status(500).json({ error: "Python parser script not found." });
  }

  const pythonProcess = spawn(PYTHON_CMD, [scriptPath]);
  let resultData = "";
  let errorData = "";

  pythonProcess.stdout.on("data", (data) => {
    resultData += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    errorData += data.toString();
  });

  pythonProcess.on("close", (code) => {
    if (code !== 0) {
      console.error(`Python parser exited with code ${code}. Error: ${errorData}`);
      return res.status(500).json({ error: "Failed to parse email", details: errorData });
    }
    
    try {
      const parsed = JSON.parse(resultData);
      res.json(parsed);
    } catch (err) {
      console.error("Failed to parse Python output: ", resultData);
      res.status(500).json({ error: "Invalid output from python parser." });
    }
  });

  pythonProcess.stdin.write(rawText);
  pythonProcess.stdin.end();
});

// URL Analysis endpoint calling python child process
app.post("/api/analyze-url", (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "Missing url." });
  }

  const scriptPath = path.join(process.cwd(), "karnakavach_backend", "url_cli.py");
  
  if (!fs.existsSync(scriptPath)) {
    return res.status(500).json({ error: "Python url analyzer script not found." });
  }

  const pythonProcess = spawn(PYTHON_CMD, [scriptPath, url]);
  let resultData = "";
  let errorData = "";

  pythonProcess.stdout.on("data", (data) => {
    resultData += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    errorData += data.toString();
  });

  pythonProcess.on("close", (code) => {
    if (code !== 0) {
      console.error(`Python url analyzer exited with code ${code}. Error: ${errorData}`);
      return res.status(500).json({ error: "Failed to analyze URL", details: errorData });
    }
    
    try {
      const parsed = JSON.parse(resultData);
      res.json(parsed);
    } catch (err) {
      console.error("Failed to parse Python output: ", resultData);
      res.status(500).json({ error: "Invalid output from python analyzer." });
    }
  });
});

// Lazy initialize Gemini clients
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Resilient wrapper for content generation with exponential backoff retry and model fallback capability
async function generateContentWithRetryAndFallback(
  client: GoogleGenAI,
  contents: any,
  config: any,
  preferredModel?: string
): Promise<any> {
  const models = preferredModel ? [preferredModel, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"] : ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  // deduplicate models array
  const uniqueModels = [...new Set(models)];
  const maxRetriesPerModel = 3;
  const initialDelayMs = 1000;
  let lastError: any = null;

  for (const model of uniqueModels) {
    console.log(`[Karna_Kavach Core] Attempting threat analysis using model: ${model}`);
    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const response = await client.models.generateContent({
          model: model,
          contents: contents,
          config: config,
        });
        if (response && response.text) {
          console.log(`[Karna_Kavach Core] Intelligence scan succeeded with model: ${model} on attempt ${attempt}`);
          return response;
        }
        throw new Error("Returned empty or corrupt response text from intelligence engine.");
      } catch (err: any) {
        lastError = err;
        console.warn(`[Karna_Kavach Core] Attempt ${attempt} failed for model ${model}. Error: ${err.message || err}`);
        
        // Fast-fail loop on client input mistakes (400)
        if (err.status === 400 || (err.message && err.message.toLowerCase().includes("400"))) {
          break; // Move to next model stage or raise error
        }
        
        if (attempt < maxRetriesPerModel) {
          const delay = initialDelayMs * Math.pow(2, attempt - 1);
          console.log(`[Karna_Kavach Core] Waiting ${delay}ms before next retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  throw lastError || new Error("Cognitive Threat Core failed across all retry and fallback models.");
}

// REST API Status check
app.get("/api/status", (req, res) => {
  const isConfigured = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY");
  res.json({ status: "ok", hasApiKey: isConfigured });
});

// REST API for Email & Payload Phishing Analysis
app.post("/api/analyze", async (req, res) => {
  const { sender, subject, body, image, images, model, sensitivity, autoUrlScan, language } = req.body;

  if (!sender && !subject && !body && !image && !(images && images.length > 0)) {
    return res.status(400).json({ error: "No input provided. Please enter email sender, subject, message body, or upload an image." });
  }

  // Define sensitivity prompt injections
  let sensitivityInstruction = "";
  if (sensitivity === "Low") {
    sensitivityInstruction = "WARNING: Analyzer is set to Low sensitivity. Minimize false positives. Only flag extreme, glaringly obvious indicators of compromise. Be extremely forgiving of bad layouts and strange sender domains.";
  } else if (sensitivity === "High") {
    sensitivityInstruction = "WARNING: Analyzer is set to High sensitivity (Aggressive heuristic and zero-day blocking). Be extremely unforgiving. Scrutinize every slight inconsistency in domain, linguistics, and attachments. Flag potential threats extensively.";
  } else {
     sensitivityInstruction = "Analyzer is set to Medium sensitivity. Execute balanced semantic threat hunting.";
  }

  // Preemptively run advanced Suspicious Link Analysis via our python models
  let urlAnalysisResults: any[] = [];
  if (autoUrlScan !== false) {
    const combinedText = `${subject || ""} ${body || ""}`;
    const urlRegex = /(https?:\/\/[^\s"'><]+)/g;
    const urlsMatch = combinedText.match(urlRegex) || [];
    const uniqueUrls = [...new Set(urlsMatch)].slice(0, 5); // limit to 5 URLs to cap latency

    if (uniqueUrls.length > 0) {
      const scriptPath = path.join(process.cwd(), "karnakavach_backend", "url_cli.py");
      if (fs.existsSync(scriptPath)) {
        for (const url of uniqueUrls) {
          try {
            const resultStr = await new Promise<string>((resolve, reject) => {
              const pyProcess = spawn(PYTHON_CMD, [scriptPath, url]);
              let dataStr = "";
              let errStr = "";
              pyProcess.stdout.on("data", (data) => dataStr += data.toString());
              pyProcess.stderr.on("data", (data) => errStr += data.toString());
              pyProcess.on("close", (code) => {
                 if (code === 0) resolve(dataStr);
                 else reject(`Error ${code}: ${errStr}`);
              });
            });
            urlAnalysisResults.push(JSON.parse(resultStr));
          } catch (e) {
            console.error(`Failed to analyze url '${url}':`, e);
          }
        }
      }
    }
  }

  const client = getGeminiClient();

  if (!client) {
    // Elegant simulated fallback with highly personalized linguistic matching if API key is not present
    console.warn("GEMINI_API_KEY is missing. Providing cognitive simulation...");
    const isUrlSuspicious = urlAnalysisResults.some(u => u.risk_score >= 40);
    const isMockSuspect = 
      sender?.includes("security") || sender?.includes("update") || sender?.includes("billing") || sender?.includes("netflix") || sender?.includes("microsoft") ||
      subject?.toLowerCase().includes("urgent") || subject?.toLowerCase().includes("suspended") || subject?.toLowerCase().includes("hold") || subject?.toLowerCase().includes("invoice") ||
      body?.toLowerCase().includes("click here") || body?.toLowerCase().includes("verify your account") || body?.toLowerCase().includes("password reset") ||
      (image && image.length > 0) || (images && images.length > 0) || isUrlSuspicious;

    const calculatedScore = isMockSuspect ? Math.floor(Math.random() * 20) + 75 : Math.floor(Math.random() * 25) + 5;
    const level = calculatedScore >= 70 ? "HIGH" : calculatedScore >= 35 ? "MEDIUM" : "LOW";

    let simulatedVectors = isMockSuspect ? [
      {
        title: "Urgency Lingustics Alert",
        description: "Contains critical keywords related to suspension, billing holds, or immediate invoices.",
        badge: "Urgency Threat",
        type: "critical"
      },
      {
        title: "Identity Authenticity Warning",
        description: "Sender handle doesn't align with high-trust secure patterns.",
        badge: "Verification Flag",
        type: "warning"
      }
    ] : [
      {
        title: "Baseline Behavioral Safe",
        description: "Linguistic vectors remain in standard user conversational bounds.",
        badge: "OK",
        type: "success"
      }
    ];

    if (isUrlSuspicious) {
      simulatedVectors.push({
        title: "Malicious Suspicious URLs",
        description: "Analyzed embedded URLs and identified known scam trackers or obscured formatting.",
        badge: "Link Phish",
        type: "critical"
      });
    }

    const simulatedResult = {
      riskScore: calculatedScore,
      riskLevel: level,
      summary: `[DEMO MODE: SIMULATED COGNITIVE SCAN]\n\nThe system analyzed your inputs.\n- Sender Address: "${sender || "Unknown"}"\n- Subject Header: "${subject || "Unknown"}"\n\nIndicators identified: ${isMockSuspect ? "Urgency linguistics found. High-pressure language detects potential bait or impersonation." : "Standard friendly language matching standard low-danger baseline parameters. No Immediate indicators of social engineering."}`,
      confidence: 88.4,
      threatVectors: simulatedVectors,
      urlAnalysis: urlAnalysisResults
    };

    return res.json({
      ...simulatedResult,
      isSimulated: true,
      message: "Karna_Kavach Live Scan is in demo simulation mode because the GEMINI_API_KEY variable is not populated in AI Studio Settings."
    });
  }

  // Real, fully-connected analysis with Gemini Flash
  try {
    const urlContextText = urlAnalysisResults.length > 0 
      ? `\n\n--- SUSPICIOUS URL ANALYSIS INCLUDED ---\nOur local python parser checked the links and found: ${JSON.stringify(urlAnalysisResults, null, 2)}\nIncorporate those URL risk findings verbatim into the final summary and output.` 
      : "";

    const languageInstruction = language && language !== "English" 
      ? `\nIMPORTANT: CRITICALLY IMPORTANT: The "summary" and "threatVectors" ("title", "description", "badge") text properties in the JSON response MUST be written in ${language}. Everything you output for human consumption MUST be natively translated to ${language} while retaining technical precision.` 
      : "";

    const analysisPrompt = `
You are KarnaKavach, a cutting-edge cognitive cyber threat and phishing email analyst.
Analyze the following email metadata, content, and the attached screenshot (if any) for phishing indicators, social engineering, urgency linguistics, zero-day links, and layout spoofing.

${sensitivityInstruction}${languageInstruction}

SENDER: ${sender || "Not provided"}
SUBJECT: ${subject || "Not provided"}
BODY/PAYLOAD:
${body || "Not provided"}${urlContextText}

Produce a rigorous threat report. Include:
1. "riskScore": integer from 0 to 100 (0=completely safe, 100=definitive phishing threat).
2. "riskLevel": Pick one string: "HIGH", "MEDIUM", or "LOW". (HIGH is score >= 70, MEDIUM is 35-69, LOW is < 35).
3. "summary": A concise yet technical and highly scannable analysis of the email's linguistic tricks, authentication errors, domain matching anomalies, visually suspicious spoofing in the image, or standard safe behavior. Mention exact quotes if applicable.
4. "confidence": A float percentage between 50.0 and 100.0 indicating engine certainty.
5. "threatVectors": An array of objects containing detailed indicators found. Each object needs:
   - "title" (e.g. "Credential Harvesting Link", "High Pressure Urgent Action", "Visual Spoofing Detected")
   - "description" (detailed explanation of why this was flagged based on text or image)
   - "badge" (short 2-3 word tag)
   - "type" (one of: "critical", "warning", "info", "success")

Return ONLY valid JSON that matches the specified schema.
`;

    const contents: any[] = [{ text: analysisPrompt }];
    
    const imageList = images || (image ? [image] : []);
    for (const img of imageList) {
      if (img) {
        const match = img.match(/^data:(image\/\w+);base64,(.*)$/);
        if (match) {
          contents.push({
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          });
        }
      }
    }

    const response = await generateContentWithRetryAndFallback(client, contents, {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          riskScore: { 
            type: Type.INTEGER, 
            description: "Phishing risk score from 0 to 100" 
          },
          riskLevel: { 
            type: Type.STRING, 
            description: "Risk Level. Return HIGH, MEDIUM, or LOW." 
          },
          summary: { 
            type: Type.STRING, 
            description: "Rigorous corporate cyberthreat analysis of domain, urgency techniques, spoof indicators, or safe credentials." 
          },
          confidence: { 
            type: Type.NUMBER, 
            description: "Analysis confidence level percentage from 0 to 100" 
          },
          threatVectors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Vector classification title" },
                description: { type: Type.STRING, description: "Detailed detection justification" },
                badge: { type: Type.STRING, description: "Short system badge code" },
                type: { 
                  type: Type.STRING, 
                  description: "Status category: critical, warning, info, success" 
                }
              },
              required: ["title", "description", "badge", "type"]
            }
          }
        },
        required: ["riskScore", "riskLevel", "summary", "confidence", "threatVectors"]
      }
    }, model);

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Empty response received from cognitive scan core.");
    }

    const cleanResult = JSON.parse(textOutput.trim());
    return res.json({
      ...cleanResult,
      isSimulated: false
    });

  } catch (error: any) {
    console.error("Gemini Scan Error:", error);
    return res.status(500).json({
      error: "Cognitive scan engine failed to process email payload.",
      details: error.message || String(error)
    });
  }
});

// ─── ML FEEDBACK API ───────────────────────────────────────────────────────

// POST /api/ml-feedback — save user feedback on an ML prediction
app.post("/api/ml-feedback", (req, res) => {
  const { sender, subject, body, urls, predicted_label, correct_label, confidence, label_verified } = req.body;

  // Basic server-side validation
  if (!subject && !body) {
    return res.status(400).json({ success: false, error: "Email subject or body is required." });
  }
  const validLabels = ["Phishing", "Legitimate"];
  if (!validLabels.includes(predicted_label)) {
    return res.status(400).json({ success: false, error: "Invalid predicted_label." });
  }
  if (correct_label && !validLabels.includes(correct_label)) {
    return res.status(400).json({ success: false, error: "Invalid correct_label." });
  }

  const scriptPath = path.join(process.cwd(), "karnakavach_backend", "feedback_cli.py");
  if (!fs.existsSync(scriptPath)) {
    return res.status(500).json({ success: false, error: "Feedback script not found." });
  }

  const payload = {
    sender: sender || "",
    subject: subject || "",
    body: body || "",
    urls: Array.isArray(urls) ? urls.join(", ") : (urls || ""),
    predicted_label,
    correct_label: correct_label || predicted_label,
    confidence: confidence || 0,
    label_verified: label_verified ?? (correct_label === predicted_label),
    source: "user_ui",
  };

  const pyProcess = spawn(PYTHON_CMD, [scriptPath]);
  let dataStr = "";
  let errStr = "";

  pyProcess.stdout.on("data", (d) => { dataStr += d.toString(); });
  pyProcess.stderr.on("data", (d) => { errStr += d.toString(); });
  pyProcess.on("close", (code) => {
    try {
      const result = JSON.parse(dataStr);
      if (result.success) {
        res.json(result);
      } else {
        res.status(409).json(result);
      }
    } catch {
      console.error("Feedback CLI output:", dataStr, errStr);
      res.status(500).json({ success: false, error: "Failed to save feedback." });
    }
  });

  pyProcess.stdin.write(JSON.stringify(payload));
  pyProcess.stdin.end();
});

// GET /api/ml-status — returns model version, dataset sizes, metrics
app.get("/api/ml-status", (req, res) => {
  const scriptPath = path.join(process.cwd(), "karnakavach_backend", "ml_status_cli.py");
  if (!fs.existsSync(scriptPath)) {
    return res.status(500).json({ error: "ML status script not found." });
  }

  const pyProcess = spawn(PYTHON_CMD, [scriptPath]);
  let dataStr = "";
  let errStr = "";

  pyProcess.stdout.on("data", (d) => { dataStr += d.toString(); });
  pyProcess.stderr.on("data", (d) => { errStr += d.toString(); });
  pyProcess.on("close", (code) => {
    try {
      res.json(JSON.parse(dataStr));
    } catch {
      res.status(500).json({ error: "Failed to read ML status." });
    }
  });
});

// POST /api/ml-retrain — triggers model retraining, streams progress via SSE
app.post("/api/ml-retrain", (req, res) => {
  const scriptPath = path.join(process.cwd(), "karnakavach_backend", "retrain_cli.py");
  if (!fs.existsSync(scriptPath)) {
    return res.status(500).json({ error: "Retrain script not found." });
  }

  // Server-Sent Events for streaming progress
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send({ type: "start", message: "Retraining initiated..." });

  const pyProcess = spawn(PYTHON_CMD, [scriptPath]);

  pyProcess.stdout.on("data", (d) => {
    const lines = d.toString().split("\n").filter((l: string) => l.trim());
    for (const line of lines) {
      // Last line is the final JSON result
      if (line.startsWith("{")) {
        try {
          const result = JSON.parse(line);
          send({ type: result.success ? "complete" : "error", ...result });
        } catch {
          send({ type: "log", message: line });
        }
      } else {
        send({ type: "log", message: line });
      }
    }
  });

  pyProcess.stderr.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg) send({ type: "log", message: `[STDERR] ${msg}` });
  });

  pyProcess.on("close", (code) => {
    if (code !== 0) {
      send({ type: "error", error: `Retraining process exited with code ${code}` });
    }
    res.end();
  });
});

// POST /api/ml-settings — save ML auto-retrain preferences
app.post("/api/ml-settings", (req, res) => {
  const { autoRetrainThreshold } = req.body;
  const settingsPath = path.join(process.cwd(), "karnakavach_ml_settings.json");
  try {
    let existing: any = {};
    if (fs.existsSync(settingsPath)) {
      existing = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    }
    existing.autoRetrainThreshold = autoRetrainThreshold ?? null;
    fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ml-feedback-download — download feedback_dataset.csv
app.get("/api/ml-feedback-download", (req, res) => {
  const feedbackPath = path.join(process.cwd(), "karnakavach_backend", "feedback_dataset.csv");
  if (!fs.existsSync(feedbackPath)) {
    return res.status(404).json({ error: "No feedback data collected yet." });
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=karnakavach_feedback.csv");
  fs.createReadStream(feedbackPath).pipe(res);
});

// ─── ML FEEDBACK API END ────────────────────────────────────────────────────

// REST API for ML Email Phishing Analysis
app.post("/api/ml-analyze", (req, res) => {
  const { sender, subject, body } = req.body;

  if (!sender && !subject && !body) {
    return res.status(400).json({ error: "No input provided." });
  }

  const scriptPath = path.join(process.cwd(), "karnakavach_backend", "predict_cli.py");
  
  if (!fs.existsSync(scriptPath)) {
    return res.status(500).json({ error: "Python ML predictor script not found." });
  }

  const pyProcess = spawn(PYTHON_CMD, [scriptPath]);
  let dataStr = "";
  let errStr = "";

  pyProcess.stdout.on("data", (data) => {
    dataStr += data.toString();
  });

  pyProcess.stderr.on("data", (data) => {
    errStr += data.toString();
  });

  pyProcess.on("close", (code) => {
    if (code !== 0) {
      console.error(`Python ML analyzer exited with code ${code}. Error: ${errStr}`);
      return res.status(500).json({ error: "ML Analysis failed", details: errStr });
    }
    
    try {
      const parsed = JSON.parse(dataStr);
      if (parsed.error) {
         return res.status(500).json({ error: parsed.error });
      }
      
      // Map to expected response format
      const reasons: string[] = [];
      // Use reasons from ML model if available, otherwise build from explanation
      if (parsed.reasons && parsed.reasons.length > 0) {
        reasons.push(...parsed.reasons);
      } else {
        if (parsed.explanation) reasons.push(parsed.explanation);
      }
      if (parsed.url_analysis && parsed.url_analysis.length > 0) {
         const highRisk = parsed.url_analysis.filter((u: any) => u.risk_score > 60);
         if (highRisk.length > 0) reasons.push(`High risk URLs detected: ${highRisk.map((u: any) => u.url).join(', ')}`);
      }
      
      res.json({
        verdict: parsed.prediction,
        confidence: Math.round(parsed.confidence_score * 100),
        probability: Math.round(parsed.probability_phishing * 100),
        reasons: reasons
      });
    } catch (err) {
      console.error("Failed to parse ML output: ", dataStr);
      res.status(500).json({ error: "Invalid output from ML analyzer." });
    }
  });

  pyProcess.stdin.write(JSON.stringify({ sender, subject, body }));
  pyProcess.stdin.end();
});

// Serve frontend assets in production / development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Karna_Kavach Cyber Intel running on http://localhost:${PORT}`);
  });
}

// ─── HYBRID ANALYSIS ENDPOINT ───────────────────────────────────────────────
// Combines Rule Engine (25%) + ML (35%) locally; Gemini adds 40% server-side.
app.post("/api/hybrid-analyze", async (req, res) => {
  const { sender, subject, body, model, sensitivity, language, images, replyTo, attachments } = req.body;

  if (!sender && !subject && !body) {
    return res.status(400).json({ error: "No input provided." });
  }

  const scriptPath = path.join(process.cwd(), "karnakavach_backend", "hybrid_predict_cli.py");
  if (!fs.existsSync(scriptPath)) {
    return res.status(500).json({ error: "Hybrid analysis script not found." });
  }

  // Step 1: Run Rule Engine + ML locally
  let hybridLocal: any = null;
  try {
    const localResult = await new Promise<string>((resolve, reject) => {
      const py = spawn(PYTHON_CMD, [scriptPath]);
      let out = "", err = "";
      py.stdout.on("data", (d) => { out += d.toString(); });
      py.stderr.on("data", (d) => { err += d.toString(); });
      py.on("close", (code) => {
        if (code === 0) resolve(out);
        else reject(err || "Hybrid script failed");
      });
      py.stdin.write(JSON.stringify({ sender, subject, body, reply_to: replyTo || "", attachments: attachments || [] }));
      py.stdin.end();
    });
    hybridLocal = JSON.parse(localResult);
  } catch (err: any) {
    console.warn("[Hybrid] Local analysis failed:", err);
    hybridLocal = { error: String(err), hybrid_score: 0, rule_score: 0, ml_probability: 0, rule_triggered: [], email_intel: {} };
  }

  // Step 2: Run Gemini AI analysis
  const client = getGeminiClient();
  let aiReport: any = null;

  if (client) {
    try {
      const sensitivityMap: Record<string, string> = {
        Low: "Be conservative. Only flag obvious threats.",
        High: "Be aggressive. Flag any suspicious indicator.",
        Medium: "Balanced analysis.",
      };
      const sensNote = sensitivityMap[sensitivity] || sensitivityMap.Medium;
      const langNote = language && language !== "English" ? `\nRespond in ${language}.` : "";

      const prompt = `You are KarnaKavach, an expert phishing email analyst.\n${sensNote}${langNote}\n\nAnalyze this email:\nSENDER: ${sender || "Unknown"}\nSUBJECT: ${subject || "None"}\nBODY:\n${body || "None"}\nREPLY-TO: ${replyTo || "None"}\nATTACHMENTS: ${JSON.stringify(attachments || [])}\n\nThe local Rule Engine detected: ${hybridLocal?.rule_triggered?.map((r: any) => r.rule).join(", ") || "none"}.\nRule score: ${hybridLocal?.rule_score ?? 0}/100. ML score: ${hybridLocal?.ml_probability ?? 0}/100.\nML Verdict was: ${hybridLocal?.ml_verdict || "Unknown"}.\n\nProvide:\n1. riskScore (0-100)\n2. riskLevel (HIGH/MEDIUM/LOW)\n3. summary (detailed explanation of WHY this is or is not phishing, and address the agreement/disagreement with the ML verdict of ${hybridLocal?.ml_verdict || "Unknown"})\n4. confidence (50-100)\n5. threatVectors array (title, description, badge, type)\n6. threatCategory (Credential Theft / Business Email Compromise / Bank Scam / Delivery Scam / Lottery Scam / Invoice Scam / Crypto Scam / Technical Support Scam / General Phishing)\n7. recommendations array (strings)\nReturn valid JSON only.`;

      const { Type } = await import("@google/genai");
      const response = await generateContentWithRetryAndFallback(client, [{ text: prompt }], {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: { type: Type.INTEGER },
            riskLevel: { type: Type.STRING },
            summary:   { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            threatCategory: { type: Type.STRING },
            threatVectors: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, badge: { type: Type.STRING }, type: { type: Type.STRING } }, required: ["title", "description", "badge", "type"] } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["riskScore", "riskLevel", "summary", "confidence", "threatVectors"],
        },
      }, model || "gemini-2.5-flash");

      aiReport = JSON.parse(response.text.trim());
    } catch (err: any) {
      console.warn("[Hybrid] Gemini analysis failed:", err?.message);
    }
  }

  // Step 3: Fuse scores — Rule 25% + ML 35% + AI 40%
  const ruleScore = hybridLocal?.rule_score ?? 0;
  const mlScore   = hybridLocal?.ml_probability ?? 0;
  const aiScore   = aiReport?.riskScore ?? null;

  let finalScore: number;
  let scoreBreakdown: any;

  if (aiScore !== null) {
    finalScore = Math.round(ruleScore * 0.25 + mlScore * 0.35 + aiScore * 0.40);
    scoreBreakdown = { rule: ruleScore, ml: mlScore, ai: aiScore, weights: { rule: 25, ml: 35, ai: 40 } };
  } else {
    // No AI — reweight to Rule 40% + ML 60%
    finalScore = Math.round(ruleScore * 0.40 + mlScore * 0.60);
    scoreBreakdown = { rule: ruleScore, ml: mlScore, ai: null, weights: { rule: 40, ml: 60, ai: 0 } };
  }

  const finalLevel = finalScore >= 70 ? "HIGH" : finalScore >= 35 ? "MEDIUM" : "LOW";
  const threatCategory = aiReport?.threatCategory || hybridLocal?.rule_threat_category || "General Phishing";

  // Build threat vectors — merge rule triggers + AI vectors
  const ruleVectors = (hybridLocal?.rule_triggered || []).map((r: any) => ({
    title: r.rule.replace(/_/g, " "),
    description: r.description,
    badge: r.severity.toUpperCase(),
    type: r.severity === "critical" ? "critical" : r.severity === "high" ? "warning" : "info",
    source: "Rule Engine",
  }));

  const aiVectors = (aiReport?.threatVectors || []).map((v: any) => ({ ...v, source: "AI Analysis" }));
  const allVectors = [...ruleVectors, ...aiVectors].slice(0, 15);

  const summary = aiReport?.summary ||
    `Hybrid analysis: Rule Engine score ${ruleScore}/100, ML score ${mlScore}/100. ` +
    (hybridLocal?.rule_triggered?.length ? `Triggered rules: ${hybridLocal.rule_triggered.map((r: any) => r.rule).join(", ")}.` : "No rules triggered.");

  // ML vs AI Comparison
  const mlIsPhishing = mlScore >= 60;
  const aiIsPhishing = aiScore !== null ? (aiScore >= 60) : (finalScore >= 60);
  const enginesAgree = aiScore !== null ? (mlIsPhishing === aiIsPhishing) : true;

  const comparison = {
    mlResult: {
      verdict: hybridLocal?.ml_verdict || (mlIsPhishing ? "Phishing" : "Legitimate"),
      confidence: hybridLocal?.ml_confidence ?? mlScore,
      reasons: hybridLocal?.ml_reasons || []
    },
    aiResult: aiScore !== null ? {
      verdict: aiIsPhishing ? "Phishing" : "Legitimate",
      confidence: aiReport?.confidence ?? aiScore,
      summary: aiReport?.summary || ""
    } : null,
    agreement: enginesAgree,
    reason: enginesAgree 
      ? `Both engines agree that this email is ${mlIsPhishing ? "Phishing" : "Legitimate"}.`
      : `Disagreement: ML model flagged this as ${mlIsPhishing ? "Phishing" : "Legitimate"} while Gemini AI assessed it as ${aiIsPhishing ? "Phishing" : "Legitimate"}. This discrepancy suggests a complex case, such as clean text features masking a dangerous credential harvest URL or system mimicry header.`
  };

  return res.json({
    riskScore:       finalScore,
    riskLevel:       finalLevel,
    summary,
    confidence:      aiReport?.confidence ?? Math.max(60, 100 - Math.abs(finalScore - mlScore)),
    threatVectors:   allVectors.length > 0 ? allVectors : [{ title: "No Threat Detected", description: "All indicators appear safe.", badge: "CLEAN", type: "success" }],
    threatCategory,
    scoreBreakdown,
    recommendations: aiReport?.recommendations || [],
    emailIntel:      hybridLocal?.email_intel || {},
    comparison,
    mlResult: {
      verdict:    hybridLocal?.ml_verdict,
      confidence: hybridLocal?.ml_confidence,
      score:      mlScore,
      reasons:    hybridLocal?.ml_reasons || [],
    },
    ruleResult: {
      score:       ruleScore,
      triggered:   hybridLocal?.rule_triggered || [],
      category:    hybridLocal?.rule_threat_category,
      urgency:     hybridLocal?.rule_urgency_score,
    },
    urlAnalyses: hybridLocal?.url_analyses || [],
    isHybrid:    true,
    aiAvailable: aiScore !== null,
  });
});

// ─── DATASET MANAGER + RETRAINING ENDPOINTS ────────────────────────────────

// GET /api/dataset-stats — build merged dataset and return statistics
app.get("/api/dataset-stats", (req, res) => {
  const scriptPath = path.join(process.cwd(), "karnakavach_backend", "dataset_builder.py");
  if (!fs.existsSync(scriptPath)) {
    return res.status(500).json({ error: "dataset_builder.py not found." });
  }

  const pyProcess = spawn(PYTHON_CMD, [scriptPath]);
  let dataStr = "";
  let errStr  = "";

  pyProcess.stdout.on("data", (d) => { dataStr += d.toString(); });
  pyProcess.stderr.on("data", (d) => { errStr  += d.toString(); });
  pyProcess.on("close", (code) => {
    // Last non-empty line is the JSON result
    const lines = dataStr.split("\n").map((l: string) => l.trim()).filter(Boolean);
    const jsonLine = lines.reverse().find((l: string) => l.startsWith("{"));
    if (!jsonLine) {
      return res.status(500).json({ error: "No JSON output from dataset builder.", details: errStr });
    }
    try {
      res.json(JSON.parse(jsonLine));
    } catch {
      res.status(500).json({ error: "Failed to parse dataset stats.", details: errStr });
    }
  });
});

// POST /api/retrain-pipeline — full retrain using dataset_builder + retrain.py via SSE
app.post("/api/retrain-pipeline", (req, res) => {
  const scriptPath = path.join(process.cwd(), "karnakavach_backend", "retrain.py");
  if (!fs.existsSync(scriptPath)) {
    return res.status(500).json({ error: "retrain.py not found." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => { res.write(`data: ${JSON.stringify(data)}\n\n`); };
  send({ type: "start", message: "Retraining pipeline initiated..." });

  const pyProcess = spawn(PYTHON_CMD, [scriptPath]);

  pyProcess.stdout.on("data", (d) => {
    const lines = d.toString().split("\n").filter((l: string) => l.trim());
    for (const line of lines) {
      if (line.startsWith("{")) {
        try {
          const result = JSON.parse(line);
          send({ type: result.success ? "complete" : "error", ...result });
        } catch {
          send({ type: "log", message: line });
        }
      } else {
        send({ type: "log", message: line });
      }
    }
  });

  pyProcess.stderr.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg) send({ type: "log", message: `[STDERR] ${msg}` });
  });

  pyProcess.on("close", (code) => {
    if (code !== 0) send({ type: "error", error: `Process exited with code ${code}` });
    res.end();
  });
});

// GET /api/training-metrics — return current metrics.json + dataset_stats.json
app.get("/api/training-metrics", (req, res) => {
  const scriptPath = path.join(process.cwd(), "karnakavach_backend", "metrics.py");
  if (!fs.existsSync(scriptPath)) {
    return res.status(500).json({ error: "metrics.py not found." });
  }

  const pyProcess = spawn(PYTHON_CMD, [scriptPath]);
  let dataStr = "";

  pyProcess.stdout.on("data", (d) => { dataStr += d.toString(); });
  pyProcess.on("close", () => {
    try {
      res.json(JSON.parse(dataStr.trim()));
    } catch {
      res.status(500).json({ error: "Failed to read metrics." });
    }
  });
});

// GET /api/metrics-download — download metrics.json file
app.get("/api/metrics-download", (req, res) => {
  const metricsPath = path.join(process.cwd(), "karnakavach_backend", "models", "metrics.json");
  if (!fs.existsSync(metricsPath)) {
    return res.status(404).json({ error: "metrics.json not found." });
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=karnakavach_metrics.json");
  fs.createReadStream(metricsPath).pipe(res);
});

// ─── DATASET MANAGER + RETRAINING ENDPOINTS END ─────────────────────────────

startServer();
