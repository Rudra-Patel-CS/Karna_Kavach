/**
 * KarnaKavach — Feedback Export Service
 *
 * Generates a downloadable CSV from Firestore feedback records.
 * CSV columns match the schema used by the Python retraining pipeline.
 *
 * CSV columns:
 *   userId, scanId, sender, subject, body, engine,
 *   riskScore, confidence, predictedLabel, correctLabel,
 *   verified, createdAt
 */

import { getUserFeedbackRecords } from "./feedbackService";
import type { FeedbackRecord } from "../types";

// ── CSV generation ────────────────────────────────────────────────────────────

function escapeCsvField(value: string | number | boolean): string {
  const str = String(value ?? "");
  // Wrap in quotes if contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function recordsToCsv(records: FeedbackRecord[]): string {
  const headers = [
    "userId",
    "scanId",
    "sender",
    "subject",
    "body",
    "engine",
    "confidence",
    "predictedLabel",
    "correctLabel",
    "verified",
    "createdAt",
  ];

  const rows = records.map((r) => [
    r.userId,
    r.scanId,
    r.sender,
    r.subject,
    r.body.replace(/\n/g, " ").slice(0, 500), // truncate long bodies for CSV readability
    r.engine,
    r.confidence,
    r.predictedLabel,
    r.correctLabel,
    r.verified,
    r.createdAt,
  ].map(escapeCsvField).join(","));

  return [headers.join(","), ...rows].join("\r\n");
}

// ── Trigger browser download ──────────────────────────────────────────────────

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Main export function ──────────────────────────────────────────────────────

/**
 * exportFeedbackDataset
 *
 * Fetches all feedback records for the given user from Firestore,
 * converts them to CSV, and triggers a browser download.
 *
 * Returns the number of records exported.
 */
export async function exportFeedbackDataset(userId: string): Promise<number> {
  const records = await getUserFeedbackRecords(userId);

  if (records.length === 0) {
    return 0;
  }

  const csv      = recordsToCsv(records);
  const date     = new Date().toISOString().slice(0, 10);
  const filename = `karnakavach_feedback_${userId.slice(0, 8)}_${date}.csv`;

  downloadCsv(csv, filename);
  return records.length;
}
