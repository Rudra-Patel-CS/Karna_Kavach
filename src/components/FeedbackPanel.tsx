import React, { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, CheckCircle, XCircle, Loader2, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Scan, FeedbackLabel } from "../types";
import { saveFeedback, checkExistingFeedback } from "../services/feedbackService";

interface FeedbackPanelProps {
  scan: Scan;
  userId: string;
}

type PanelState = "idle" | "checking" | "asking_label" | "submitting" | "done_correct" | "done_incorrect" | "duplicate" | "error";

export default function FeedbackPanel({ scan, userId }: FeedbackPanelProps) {
  const [state, setState] = useState<PanelState>("checking");
  const [selectedLabel, setSelectedLabel] = useState<FeedbackLabel | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Derive the predicted label from the scan result
  const predictedLabel: FeedbackLabel =
    scan.riskLevel === "HIGH" ? "Phishing" :
    scan.riskLevel === "MEDIUM" ? "Suspicious" :
    "Legitimate";

  // On mount — check if this user already gave feedback for this scan
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId || !scan.id) { setState("idle"); return; }
      const exists = await checkExistingFeedback(userId, scan.id);
      if (!cancelled) setState(exists ? "duplicate" : "idle");
    })();
    return () => { cancelled = true; };
  }, [userId, scan.id]);

  const submitFeedback = async (correctLabel: FeedbackLabel, verified: boolean) => {
    setState("submitting");
    setErrorMsg("");
    try {
      const result = await saveFeedback({
        userId,
        scanId: scan.id,
        engine: scan.engine ?? "Gemini AI",
        sender:  scan.sender,
        subject: scan.subject,
        body:    scan.body,
        predictedLabel,
        correctLabel,
        confidence: scan.confidence,
        verified,
      });

      if (result === null) {
        // null means duplicate was blocked inside saveFeedback
        setState("duplicate");
      } else {
        setState(verified ? "done_correct" : "done_incorrect");
      }
    } catch {
      setErrorMsg("Failed to save feedback. Please try again.");
      setState("error");
    }
  };

  const handleCorrect = () => submitFeedback(predictedLabel, true);
  const handleIncorrect = () => setState("asking_label");
  const handleLabelSelect = (label: FeedbackLabel) => {
    setSelectedLabel(label);
    submitFeedback(label, false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl border border-outline-variant/20 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-outline-variant/10 bg-surface-container-low/30">
        <MessageSquare className="w-3.5 h-3.5 text-primary-fixed-dim" />
        <span className="font-display font-black text-[10px] uppercase tracking-widest text-primary-fixed-dim">
          Was this analysis correct?
        </span>
        <span className="ml-auto font-mono text-[9px] text-outline-variant uppercase tracking-wider">
          {scan.engine ?? "AI Engine"}
        </span>
      </div>

      <div className="px-4 py-4">
        <AnimatePresence mode="wait">

          {/* CHECKING — duplicate check in progress */}
          {state === "checking" && (
            <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 py-2 text-xs text-outline-variant">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Checking feedback status...
            </motion.div>
          )}

          {/* IDLE — show thumbs up / down */}
          {state === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-3">
              <p className="text-xs text-on-surface-variant">
                Help improve the model by verifying this result.
                Predicted: <span className={`font-bold ${
                  predictedLabel === "Phishing" ? "text-rose-400" :
                  predictedLabel === "Suspicious" ? "text-amber-400" :
                  "text-emerald-400"
                }`}>{predictedLabel}</span>
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={handleCorrect}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/8 hover:bg-emerald-500/15 text-emerald-400 text-xs font-bold uppercase tracking-wider transition-all group">
                  <ThumbsUp className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  Correct
                </button>
                <button type="button" onClick={handleIncorrect}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/8 hover:bg-rose-500/15 text-rose-400 text-xs font-bold uppercase tracking-wider transition-all group">
                  <ThumbsDown className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  Incorrect
                </button>
              </div>
            </motion.div>
          )}

          {/* ASKING LABEL — user picked incorrect, now choose correct label */}
          {state === "asking_label" && (
            <motion.div key="asking" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-3">
              <p className="text-xs font-bold text-on-surface">What is the correct classification?</p>
              <div className="grid grid-cols-3 gap-2">
                {(["Legitimate", "Suspicious", "Phishing"] as FeedbackLabel[]).map((label) => (
                  <button key={label} type="button" onClick={() => handleLabelSelect(label)}
                    className={`py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
                      label === "Legitimate" ? "border-emerald-500/30 bg-emerald-500/8 hover:bg-emerald-500/15 text-emerald-400" :
                      label === "Suspicious" ? "border-amber-500/30 bg-amber-500/8 hover:bg-amber-500/15 text-amber-400" :
                      "border-rose-500/30 bg-rose-500/8 hover:bg-rose-500/15 text-rose-400"
                    } ${selectedLabel === label ? "ring-1 ring-current" : ""}`}>
                    {label === "Legitimate" ? "✓ " : label === "Suspicious" ? "⚠ " : "✕ "}{label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setState("idle")}
                className="text-[10px] text-outline-variant hover:text-on-surface transition-colors text-center">
                Cancel
              </button>
            </motion.div>
          )}

          {/* SUBMITTING */}
          {state === "submitting" && (
            <motion.div key="submitting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 py-3 text-xs text-primary-fixed-dim">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving to Firestore...
            </motion.div>
          )}

          {/* DONE CORRECT */}
          {state === "done_correct" && (
            <motion.div key="done_correct" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 py-2">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-400">Feedback saved — thank you!</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">
                  Confirmed as <span className="font-bold">{predictedLabel}</span>. Helps improve future accuracy.
                </p>
              </div>
            </motion.div>
          )}

          {/* DONE INCORRECT */}
          {state === "done_incorrect" && (
            <motion.div key="done_incorrect" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 py-2">
              <CheckCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-400">Correction saved — model will learn!</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">
                  Corrected from <span className={`font-bold ${predictedLabel === "Phishing" ? "text-rose-400" : "text-emerald-400"}`}>{predictedLabel}</span>
                  {" → "}
                  <span className={`font-bold ${selectedLabel === "Phishing" ? "text-rose-400" : selectedLabel === "Suspicious" ? "text-amber-400" : "text-emerald-400"}`}>{selectedLabel}</span>.
                </p>
              </div>
            </motion.div>
          )}

          {/* DUPLICATE */}
          {state === "duplicate" && (
            <motion.div key="duplicate" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-2 py-2 text-outline-variant">
              <XCircle className="w-4 h-4 shrink-0" />
              <p className="text-[11px]">Feedback already submitted for this scan.</p>
            </motion.div>
          )}

          {/* ERROR */}
          {state === "error" && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center justify-between gap-3 py-2">
              <div className="flex items-center gap-2 text-rose-400">
                <XCircle className="w-4 h-4 shrink-0" />
                <p className="text-xs">{errorMsg}</p>
              </div>
              <button type="button" onClick={() => setState("idle")}
                className="text-[10px] text-outline-variant hover:text-on-surface transition-colors shrink-0">
                Retry
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
}
