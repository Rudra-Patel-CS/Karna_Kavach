/**
 * KarnaKavach — ML Service
 *
 * Fetches model status, metrics, and triggers retraining via the Express backend.
 * Also reads/writes model version records to Firestore ml_models collection.
 */

import { MLStatus, ModelVersion } from "../types";

// ── Backend API calls (Express → Python) ─────────────────────────────────────

/** Fetch current ML model status from the Node backend */
export async function fetchMLStatus(): Promise<MLStatus | null> {
  try {
    const res = await fetch("/api/ml-status");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Trigger model retraining via SSE stream.
 * Returns an EventSource-style async iterator.
 * onLog is called for each progress line; onComplete for final metrics.
 */
export async function triggerRetraining(
  onLog: (msg: string) => void,
  onComplete: (metrics: any) => void,
  onError: (err: string) => void
): Promise<void> {
  try {
    const res = await fetch("/api/ml-retrain", { method: "POST" });

    if (!res.body) {
      onError("No response stream from server.");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split("\n").filter((l) => l.startsWith("data: "));

      for (const line of lines) {
        try {
          const event = JSON.parse(line.replace("data: ", ""));
          if (event.type === "log") {
            onLog(event.message ?? "");
          } else if (event.type === "complete") {
            onComplete(event.metrics ?? {});
          } else if (event.type === "error") {
            onError(event.error ?? "Retraining failed.");
          }
        } catch {
          // partial chunk — ignore
        }
      }
    }
  } catch (err: any) {
    onError(err?.message ?? "Network error during retraining.");
  }
}

/** Save auto-retrain threshold preference */
export async function saveAutoRetrainSetting(threshold: number | null): Promise<void> {
  try {
    await fetch("/api/ml-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoRetrainThreshold: threshold }),
    });
  } catch { /* non-critical */ }
}
