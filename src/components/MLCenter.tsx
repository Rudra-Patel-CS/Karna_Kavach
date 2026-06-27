import React, { useState, useEffect, useRef } from "react";
import { Brain, RotateCcw, Download, ChevronDown, ChevronUp, Check,
  AlertTriangle, Loader2, Activity, Database, BarChart3, Clock,
  Zap, History, Star, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { MLStatus, ModelVersion, TrainingJob, FeedbackStats } from "../types";
import { fetchMLStatus, triggerRetraining, saveAutoRetrainSetting } from "../services/mlService";
import { getModelVersions, saveModelVersion } from "../services/modelVersionService";
import { getFeedbackStats } from "../services/feedbackService";
import { exportFeedbackDataset } from "../services/feedbackExportService";

interface MLCenterProps { userId: string; }

export default function MLCenter({ userId }: MLCenterProps) {
  const [mlStatus, setMlStatus] = useState<MLStatus | null>(null);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [fbStats, setFbStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [showVersions, setShowVersions] = useState(false);
  const [autoThreshold, setAutoThreshold] = useState<number | null>(null);
  const [job, setJob] = useState<TrainingJob>({
    status: "idle", startedAt: null, completedAt: null,
    durationMs: null, logs: [], error: null, resultVersion: null,
  });
  const logsRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    setLoading(true);
    const [status, versionList, stats] = await Promise.all([
      fetchMLStatus(),
      getModelVersions(),
      getFeedbackStats(userId),
    ]);
    setMlStatus(status);
    setVersions(versionList);
    setFbStats(stats);
    setAutoThreshold(status?.auto_retrain_threshold ?? null);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [userId]);
  useEffect(() => { logsRef.current?.scrollIntoView({ behavior: "smooth" }); }, [job.logs]);

  const handleRetrain = async () => {
    const start = Date.now();
    setJob({ status: "running", startedAt: new Date().toISOString(),
      completedAt: null, durationMs: null, logs: ["[START] Initiating retraining pipeline..."],
      error: null, resultVersion: null });

    await triggerRetraining(
      (msg) => setJob((j) => ({ ...j, logs: [...j.logs, msg] })),
      async (metrics) => {
        const ms = Date.now() - start;
        const fbCount = fbStats?.total ?? 0;
        await saveModelVersion(metrics, fbCount);
        await refresh();
        setJob((j) => ({
          ...j, status: "completed", completedAt: new Date().toISOString(),
          durationMs: ms, logs: [...j.logs, `[DONE] Model v${metrics.version} ready. Duration: ${(ms / 1000).toFixed(1)}s`],
        }));
      },
      (err) => setJob((j) => ({
        ...j, status: "failed", error: err,
        logs: [...j.logs, `[ERROR] ${err}`],
      }))
    );
  };

  const handleExport = async () => {
    setExporting(true);
    setExportMsg("");
    const count = await exportFeedbackDataset(userId);
    setExporting(false);
    setExportMsg(count > 0 ? `✅ Exported ${count} records` : "No feedback records found.");
    setTimeout(() => setExportMsg(""), 4000);
  };

  const handleThreshold = async (t: number | null) => {
    setAutoThreshold(t);
    await saveAutoRetrainSetting(t);
  };

  const activeVersion = versions.find((v) => v.active) ?? versions[0] ?? null;
  const metrics = activeVersion ?? (mlStatus?.metrics ? {
    accuracy: mlStatus.metrics.accuracy, precision: mlStatus.metrics.precision,
    recall: mlStatus.metrics.recall, f1Score: mlStatus.metrics.f1_score,
    rocAuc: mlStatus.metrics.roc_auc, confusionMatrix: mlStatus.metrics.confusion_matrix,
    datasetSize: mlStatus.metrics.dataset_size, nLegitimate: mlStatus.metrics.n_legitimate,
    nPhishing: mlStatus.metrics.n_phishing,
  } : null) as any;

  const metricCards = metrics ? [
    { label: "Accuracy",  value: `${(metrics.accuracy  * 100).toFixed(1)}%`, color: metrics.accuracy  >= 0.9 ? "text-emerald-400" : "text-amber-400" },
    { label: "Precision", value: `${(metrics.precision * 100).toFixed(1)}%`, color: "text-primary-fixed-dim" },
    { label: "Recall",    value: `${(metrics.recall    * 100).toFixed(1)}%`, color: "text-primary-fixed-dim" },
    { label: "F1-Score",  value: `${(metrics.f1Score   * 100).toFixed(1)}%`, color: "text-primary-fixed-dim" },
    { label: "ROC-AUC",   value: `${(metrics.rocAuc    * 100).toFixed(1)}%`, color: metrics.rocAuc    >= 0.95 ? "text-emerald-400" : "text-amber-400" },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="font-display font-black text-xs uppercase tracking-widest text-indigo-400">Machine Learning Center</h2>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Monitor, retrain, and manage your phishing detection model.</p>
          </div>
        </div>
        <button onClick={refresh} disabled={loading}
          className="p-2 rounded-lg border border-outline-variant/30 hover:border-indigo-500/40 text-outline-variant hover:text-indigo-400 transition-all disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-outline-variant">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading ML Center...</span>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Model Info + Training Metrics ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Model Info Panel */}
            <div className="glass-panel p-6 rounded-3xl border border-indigo-500/20 flex flex-col gap-4">
              <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Model Information
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Active Version",   value: activeVersion?.version ?? mlStatus?.version_label ?? "v1" },
                  { label: "Model Type",        value: activeVersion?.modelType ?? "TF-IDF + Logistic Regression" },
                  { label: "Training Dataset",  value: `${(mlStatus?.dataset_size ?? 0).toLocaleString()} samples` },
                  { label: "Feedback Dataset",  value: `${(mlStatus?.feedback_size ?? 0).toLocaleString()} samples` },
                  { label: "Total Feedback",    value: `${(fbStats?.total ?? 0).toLocaleString()} verified` },
                  { label: "Last Retrained",    value: mlStatus?.last_trained
                    ? new Date(mlStatus.last_trained).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : "Never" },
                  { label: "Model Status",      value: "Active", highlight: true },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-outline-variant/10 last:border-0">
                    <span className="text-xs text-on-surface-variant">{label}</span>
                    <span className={`font-mono text-xs font-bold truncate max-w-[160px] ${highlight ? "text-emerald-400" : "text-on-surface"}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Training Metrics Panel */}
            <div className="glass-panel p-6 rounded-3xl border border-indigo-500/20 flex flex-col gap-4">
              <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Training Metrics
              </h3>
              {metricCards.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {metricCards.map(({ label, value, color }) => (
                      <div key={label} className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/15 text-center">
                        <div className={`font-display font-black text-xl ${color}`}>{value}</div>
                        <div className="text-[9px] uppercase tracking-wider text-outline-variant font-bold mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                  {metrics?.confusionMatrix?.length === 2 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-outline-variant font-bold mb-2">Confusion Matrix</p>
                      <div className="grid grid-cols-2 gap-1 w-fit font-mono text-xs">
                        {[
                          { v: metrics.confusionMatrix[0][0], label: "True Legit",    c: "emerald" },
                          { v: metrics.confusionMatrix[0][1], label: "False Phish",   c: "rose" },
                          { v: metrics.confusionMatrix[1][0], label: "Missed Phish",  c: "amber" },
                          { v: metrics.confusionMatrix[1][1], label: "True Phish",    c: "emerald" },
                        ].map(({ v, label, c }) => (
                          <div key={label} className={`bg-${c}-500/15 border border-${c}-500/30 text-${c}-400 rounded px-3 py-2 text-center`}>
                            <div className="font-black text-lg">{v}</div>
                            <div className="text-[8px] uppercase tracking-wider opacity-70">{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-outline-variant text-center py-6">No metrics available yet. Retrain the model to generate metrics.</p>
              )}
            </div>
          </div>

          {/* ── Feedback Analytics ── */}
          {fbStats && (
            <div className="glass-panel p-6 rounded-3xl border border-indigo-500/20">
              <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-indigo-400 flex items-center gap-2 mb-4">
                <Database className="w-4 h-4" /> Feedback Analytics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Feedback",       value: fbStats.total,             color: "text-indigo-400" },
                  { label: "Correct Predictions",  value: fbStats.correct,           color: "text-emerald-400" },
                  { label: "Incorrect Predictions", value: fbStats.incorrect,         color: "text-rose-400" },
                  { label: "Estimated Accuracy",   value: `${fbStats.estimatedAccuracy}%`, color: fbStats.estimatedAccuracy >= 80 ? "text-emerald-400" : "text-amber-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/15 text-center">
                    <div className={`font-display font-black text-2xl ${color}`}>{value}</div>
                    <div className="text-[9px] uppercase tracking-wider text-outline-variant font-bold mt-1">{label}</div>
                  </div>
                ))}
              </div>
              {fbStats.total > 0 && (
                <div className="mt-4 space-y-2">
                  {[
                    { label: "Correct", count: fbStats.correct,   color: "bg-emerald-500" },
                    { label: "Incorrect", count: fbStats.incorrect, color: "bg-rose-500" },
                  ].map(({ label, count, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-[10px] font-mono mb-1">
                        <span className="text-on-surface-variant">{label}</span>
                        <span className="text-on-surface font-bold">{fbStats.total > 0 ? Math.round((count / fbStats.total) * 100) : 0}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                        <div className={`h-full ${color} transition-all duration-700`}
                          style={{ width: fbStats.total > 0 ? `${(count / fbStats.total) * 100}%` : "0%" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Export + Auto-Retrain ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Export Dataset */}
            <div className="glass-panel p-6 rounded-3xl border border-indigo-500/20 flex flex-col gap-4">
              <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <Download className="w-4 h-4" /> Export Feedback Dataset
              </h3>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Download all feedback records as a CSV file. Compatible with the Python retraining pipeline — fields include sender, subject, body, predictedLabel, correctLabel, and confidence.
              </p>
              <div className="flex flex-col gap-2">
                <button onClick={handleExport} disabled={exporting || !fbStats?.total}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl border border-indigo-500/30 text-xs font-bold uppercase tracking-wider text-indigo-400 hover:bg-indigo-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  {exporting ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating CSV...</> : <><Download className="w-4 h-4" /> Export Feedback Dataset</>}
                </button>
                {exportMsg && <p className="text-[11px] text-center text-emerald-400 font-mono">{exportMsg}</p>}
                <p className="text-[10px] text-outline-variant text-center font-mono">
                  {fbStats?.total ?? 0} records available
                </p>
              </div>
            </div>

            {/* Auto Retrain */}
            <div className="glass-panel p-6 rounded-3xl border border-indigo-500/20 flex flex-col gap-4">
              <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <Zap className="w-4 h-4" /> Auto-Retrain Threshold
              </h3>
              <p className="text-[11px] text-on-surface-variant">Trigger retraining automatically when feedback reaches a threshold.</p>
              <div className="space-y-2">
                {([null, 50, 100, 500] as (number | null)[]).map((t) => (
                  <button key={String(t)} type="button" onClick={() => handleThreshold(t)}
                    className={`w-full py-2.5 px-4 rounded-lg border text-xs font-bold uppercase tracking-wider text-left flex items-center justify-between transition-all ${
                      autoThreshold === t
                        ? "border-indigo-500 bg-indigo-500/15 text-indigo-300"
                        : "border-outline-variant/20 text-on-surface-variant hover:border-indigo-500/30 hover:text-on-surface"
                    }`}>
                    <span>{t === null ? "Off (Manual only)" : `Every ${t} feedback samples`}</span>
                    {autoThreshold === t && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </button>
                ))}
              </div>
              {mlStatus?.should_auto_retrain && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
                  <Zap className="w-3.5 h-3.5 shrink-0" /> Threshold reached — retrain recommended!
                </div>
              )}
            </div>
          </div>

          {/* ── Retrain Model ── */}
          <div className="glass-panel p-6 rounded-3xl border border-indigo-500/25 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Retrain Model
                </h3>
                <p className="text-[11px] text-on-surface-variant mt-1">
                  Merges original dataset + feedback, removes duplicates, balances classes, trains a new versioned model, and saves metrics to Firestore.
                </p>
              </div>
              <button onClick={handleRetrain} disabled={job.status === "running"} type="button"
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-display font-black text-xs tracking-widest uppercase transition-all shrink-0 ${
                  job.status === "running"  ? "bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 cursor-wait"
                  : job.status === "completed" ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                  : job.status === "failed"    ? "bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25"
                  : "bg-indigo-500 hover:bg-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                }`}>
                {job.status === "running"   ? <><span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> Training...</>
                 : job.status === "completed" ? <><Check className="w-4 h-4" /> Done!</>
                 : job.status === "failed"    ? <><AlertTriangle className="w-4 h-4" /> Retry</>
                 : <><RotateCcw className="w-4 h-4" /> Retrain Model</>}
              </button>
            </div>

            {/* Training status bar */}
            {job.startedAt && (
              <div className="flex items-center gap-4 text-[10px] font-mono text-outline-variant">
                {job.startedAt && <span>Started: {new Date(job.startedAt).toLocaleTimeString()}</span>}
                {job.completedAt && <span>Completed: {new Date(job.completedAt).toLocaleTimeString()}</span>}
                {job.durationMs && <span className="text-primary-fixed-dim font-bold">Duration: {(job.durationMs / 1000).toFixed(1)}s</span>}
              </div>
            )}

            {/* Live log terminal */}
            {job.logs.length > 0 && (
              <div className="bg-black/40 rounded-xl border border-outline-variant/20 p-4 font-mono text-[11px] max-h-48 overflow-y-auto space-y-0.5">
                {job.logs.map((log, i) => (
                  <div key={i} className={`leading-relaxed ${
                    log.includes("[ERROR]") ? "text-rose-400"
                    : log.includes("[DONE]") ? "text-emerald-300 font-bold"
                    : log.includes("[START]") ? "text-indigo-400"
                    : "text-emerald-500/80"
                  }`}>{log}</div>
                ))}
                <div ref={logsRef} />
              </div>
            )}
          </div>

          {/* ── Model Version History ── */}
          <div className="glass-panel p-6 rounded-3xl border border-indigo-500/20 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <History className="w-4 h-4" /> Model Version History
              </h3>
              <button onClick={() => setShowVersions((v) => !v)} type="button"
                className="text-outline-variant hover:text-indigo-400 transition-colors">
                {showVersions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {versions.length === 0 ? (
              <p className="text-[11px] text-outline-variant text-center py-4">No model versions recorded yet. Train a model to start version history.</p>
            ) : (
              <>
                {/* Active version summary */}
                {activeVersion && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <div className="flex items-center gap-3">
                      <Star className="w-4 h-4 text-indigo-400" />
                      <div>
                        <span className="font-mono font-black text-sm text-indigo-400">{activeVersion.version}</span>
                        <span className="text-[10px] text-outline-variant ml-2">Active</span>
                      </div>
                    </div>
                    <div className="flex gap-4 text-[10px] font-mono">
                      <span className="text-emerald-400">{(activeVersion.accuracy * 100).toFixed(1)}% acc</span>
                      <span className="text-outline-variant">{activeVersion.datasetSize.toLocaleString()} samples</span>
                    </div>
                  </div>
                )}

                <AnimatePresence>
                  {showVersions && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-2">
                      {versions.map((v) => (
                        <div key={v.id}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                            v.active ? "bg-indigo-500/5 border-indigo-500/20" : "bg-surface-container-low border-outline-variant/15"
                          }`}>
                          <div className="flex items-center gap-3">
                            {v.active && <Star className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                            <div>
                              <span className="font-mono font-bold text-xs text-on-surface">{v.version}</span>
                              <p className="text-[9px] text-outline-variant mt-0.5">
                                {new Date(v.trainedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-4 text-[10px] font-mono text-outline-variant">
                            <span className={v.accuracy >= 0.9 ? "text-emerald-400" : "text-amber-400"}>{(v.accuracy * 100).toFixed(1)}%</span>
                            <span>F1: {(v.f1Score * 100).toFixed(1)}%</span>
                            <span>{v.datasetSize.toLocaleString()} samples</span>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
