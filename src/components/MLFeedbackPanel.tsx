import React, { useState } from "react";
import { ThumbsUp, ThumbsDown, CheckCircle, XCircle, Loader2, Brain } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Scan } from "../types";

interface MLFeedbackPanelProps {
  scan: Scan;
}

type FeedbackState = "idle" | "asking" | "submitting" | "done_correct" | "done_corrected" | "error" | "duplicate";

export default function MLFeedbackPanel({ scan }: MLFeedbackPanelProps) {
  const [state, setState] = useState<FeedbackState>("idle");
  const [selectedLabel, setSelectedLabel] = useState<"Phishing" | "Legitimate" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const predictedLabel: "Phishing" | "Legitimate" =
    scan.riskLevel === "HIGH" ? "Phishing" : "Legitimate";

  const extractUrls = (text: string): string[] => {
    const urlPattern = /https?:\/\/[^\s"'><]+/g;
    return [...new Set(text.match(urlPattern) || [])].slice(0, 10);
  };

  const submitFeedback = async (correct_label: "Phishing" | "Legitimate", isCorrect: boolean) => {
    setState("submitting");
    setErrorMsg("");

    const urls = extractUrls(`${scan.subject} ${scan.body}`);

    try {
      const res = await fetch("/api/ml-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: scan.sender,
          subject: scan.subject,
          body: scan.body,
          urls,
          predicted_label: predictedLabel,
          correct_label,
          confidence: scan.confidence,
          label_verified: isCorrect,
        }),
      });

      const data = await res.json();

      if (data.duplicate) {
        setState("duplicate");
        return;
      }
      if (!data.success) {
        setErrorMsg(data.error || "Failed to save feedback.");
        setState("error");
        return;
      }

      setState(isCorrect ? "done_correct" : "done_corrected");
    } catch (err: any) {
      setErrorMsg("Network error saving feedback.");
      setState("error");
    }
  };

  const handleThumbsUp = () => submitFeedback(predictedLabel, true);

  const handleThumbsDown = () => setState("asking");

  const handleCorrection = (label: "Phishing" | "Legitimate") => {
    setSelectedLabel(label);
    submitFeedback(label, false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl border border-indigo-500/20 bg-indigo-500/5 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-indigo-500/15">
        <Brain className="w-3.5 h-3.5 text-indigo-400" />
        <span className="font-display font-black text-[10px] uppercase tracking-widest text-indigo-400">
          Active Learning Feedback
        </span>
        <span className="ml-auto font-mono text-[9px] text-outline-variant uppercase tracking-wider">
          ML Engine Only
        </span>
      </div>

      <div className="px-4 py-4">
        <AnimatePresence mode="wait">

          {/* IDLE — show thumbs */}
          {state === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3"
            >
              <p className="text-xs text-on-surface-variant">
                Was the ML prediction correct? Your feedback trains the model.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleThumbsUp}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/8 hover:bg-emerald-500/15 text-emerald-400 text-xs font-bold uppercase tracking-wider transition-all group"
                >
                  <ThumbsUp className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  Correct
                </button>
                <button
                  onClick={handleThumbsDown}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/8 hover:bg-rose-500/15 text-rose-400 text-xs font-bold uppercase tracking-wider transition-all group"
                >
                  <ThumbsDown className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  Wrong
                </button>
              </div>
              <p className="text-[10px] text-outline-variant text-center">
                Predicted: <span className={`font-bold ${predictedLabel === "Phishing" ? "text-rose-400" : "text-emerald-400"}`}>{predictedLabel}</span>
              </p>
            </motion.div>
          )}

          {/* ASKING — what's the correct label? */}
          {state === "asking" && (
            <motion.div
              key="asking"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3"
            >
              <p className="text-xs font-bold text-on-surface">What is the correct label?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleCorrection("Legitimate")}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
                    selectedLabel === "Legitimate"
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                      : "border-emerald-500/30 bg-emerald-500/8 hover:bg-emerald-500/15 text-emerald-400"
                  }`}
                >
                  ✓ Legitimate Email
                </button>
                <button
                  onClick={() => handleCorrection("Phishing")}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
                    selectedLabel === "Phishing"
                      ? "border-rose-500 bg-rose-500/20 text-rose-300"
                      : "border-rose-500/30 bg-rose-500/8 hover:bg-rose-500/15 text-rose-400"
                  }`}
                >
                  ⚠ Phishing Email
                </button>
              </div>
              <button
                onClick={() => setState("idle")}
                className="text-[10px] text-outline-variant hover:text-on-surface transition-colors text-center"
              >
                Cancel
              </button>
            </motion.div>
          )}

          {/* SUBMITTING */}
          {state === "submitting" && (
            <motion.div
              key="submitting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 py-3 text-xs text-indigo-400"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving feedback to training dataset...
            </motion.div>
          )}

          {/* DONE CORRECT */}
          {state === "done_correct" && (
            <motion.div
              key="done_correct"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 py-2"
            >
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-400">Feedback saved — thank you!</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">
                  Confirmed as <span className="font-bold">{predictedLabel}</span>. This sample will improve future predictions.
                </p>
              </div>
            </motion.div>
          )}

          {/* DONE CORRECTED */}
          {state === "done_corrected" && (
            <motion.div
              key="done_corrected"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 py-2"
            >
              <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-indigo-400">Correction saved — model will learn!</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">
                  Corrected from <span className="font-bold text-rose-400">{predictedLabel}</span> to <span className={`font-bold ${selectedLabel === "Phishing" ? "text-rose-400" : "text-emerald-400"}`}>{selectedLabel}</span>. Retrain to apply.
                </p>
              </div>
            </motion.div>
          )}

          {/* DUPLICATE */}
          {state === "duplicate" && (
            <motion.div
              key="duplicate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 py-2 text-outline-variant"
            >
              <XCircle className="w-4 h-4 shrink-0" />
              <p className="text-[11px]">This email was already submitted. No duplicate stored.</p>
            </motion.div>
          )}

          {/* ERROR */}
          {state === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between gap-3 py-2"
            >
              <div className="flex items-center gap-2 text-rose-400">
                <XCircle className="w-4 h-4 shrink-0" />
                <p className="text-xs">{errorMsg}</p>
              </div>
              <button
                onClick={() => setState("idle")}
                className="text-[10px] text-outline-variant hover:text-on-surface transition-colors shrink-0"
              >
                Retry
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
}
