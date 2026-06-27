/**
 * KarnaKavach — Firestore Feedback Service
 *
 * Manages user feedback on analysis results in the `feedback` collection.
 *
 * Collection: feedback/{auto-id}
 * Each document represents one user's verdict on one scan result.
 *
 * Functions:
 *   saveFeedback(payload)          – write a new feedback document
 *   checkExistingFeedback(uid, scanId) – duplicate check before writing
 *   getFeedbackStats(uid)          – aggregate stats for dashboard
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, isDummy } from "../firebase";
import type { FeedbackLabel, FeedbackRecord, FeedbackStats } from "../types";

// ── Types for the write payload ───────────────────────────────────────────────

export interface SaveFeedbackInput {
  userId: string;
  scanId: string;
  engine: "Gemini AI" | "Machine Learning";
  sender: string;
  subject: string;
  body: string;
  predictedLabel: FeedbackLabel;
  correctLabel: FeedbackLabel;
  confidence: number;
  verified: boolean;
}

// ── saveFeedback ──────────────────────────────────────────────────────────────

/**
 * Saves a feedback document to Firestore.
 * Performs a duplicate check first — one feedback entry per user per scan.
 * Returns the new document ID on success, or null if duplicate/offline.
 */
export async function saveFeedback(input: SaveFeedbackInput): Promise<string | null> {
  if (isDummy || !db) {
    // Offline fallback — persist to localStorage
    _saveLocalFeedback(input);
    console.log("[Feedback] Offline mode — feedback saved to localStorage.");
    return `local_${Date.now()}`;
  }

  try {
    // Duplicate guard
    const existing = await checkExistingFeedback(input.userId, input.scanId);
    if (existing) {
      console.warn("[Feedback] Duplicate feedback blocked for scanId:", input.scanId);
      return null;
    }

    const docRef = await addDoc(collection(db, "feedback"), {
      userId:         input.userId,
      scanId:         input.scanId,
      engine:         input.engine,
      sender:         String(input.sender   || "").slice(0, 256),
      subject:        String(input.subject  || "").slice(0, 512),
      body:           String(input.body     || "").slice(0, 65536),
      predictedLabel: input.predictedLabel,
      correctLabel:   input.correctLabel,
      confidence:     Math.min(100, Math.max(0, Number(input.confidence) || 0)),
      verified:       input.verified,
      createdAt:      serverTimestamp(),
    });

    console.log("[Feedback] ✅ Saved to Firestore. docId:", docRef.id);
    return docRef.id;
  } catch (err: any) {
    console.error("[Feedback] ❌ Firestore write failed:", err?.message);
    // Fall back to localStorage so the feedback isn't lost
    _saveLocalFeedback(input);
    return null;
  }
}

// ── checkExistingFeedback ─────────────────────────────────────────────────────

/**
 * Returns true if a feedback record already exists for this user + scan combo.
 */
export async function checkExistingFeedback(userId: string, scanId: string): Promise<boolean> {
  if (isDummy || !db || !userId || !scanId) return false;

  try {
    const q = query(
      collection(db, "feedback"),
      where("userId", "==", userId),
      where("scanId", "==", scanId)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (err: any) {
    console.warn("[Feedback] Duplicate check failed:", err?.message);
    return false; // allow write on failure — better than silently blocking
  }
}

// ── getFeedbackStats ──────────────────────────────────────────────────────────

/**
 * Aggregates feedback stats for the authenticated user.
 * Used by the Dashboard to show Total / Correct / Incorrect / Accuracy.
 */
export async function getFeedbackStats(userId: string): Promise<FeedbackStats> {
  const empty: FeedbackStats = { total: 0, correct: 0, incorrect: 0, estimatedAccuracy: 0 };

  if (isDummy || !db || !userId) {
    return _getLocalFeedbackStats();
  }

  try {
    const q = query(collection(db, "feedback"), where("userId", "==", userId));
    const snap = await getDocs(q);

    let correct = 0;
    let incorrect = 0;

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (d.verified === true) {
        correct++;
      } else {
        incorrect++;
      }
    });

    const total = correct + incorrect;
    const estimatedAccuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    return { total, correct, incorrect, estimatedAccuracy };
  } catch (err: any) {
    console.warn("[Feedback] Stats fetch failed:", err?.message);
    return empty;
  }
}

// ── getUserFeedbackRecords ────────────────────────────────────────────────────

/**
 * Returns all feedback records for a user (used for history display).
 */
export async function getUserFeedbackRecords(userId: string): Promise<FeedbackRecord[]> {
  if (isDummy || !db || !userId) return [];

  try {
    const q = query(collection(db, "feedback"), where("userId", "==", userId));
    const snap = await getDocs(q);
    const records: FeedbackRecord[] = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      let createdAt = new Date().toISOString();
      if (d.createdAt instanceof Timestamp) {
        createdAt = d.createdAt.toDate().toISOString();
      }
      records.push({
        feedbackId:     docSnap.id,
        userId:         d.userId,
        scanId:         d.scanId,
        engine:         d.engine,
        sender:         d.sender,
        subject:        d.subject,
        body:           d.body,
        predictedLabel: d.predictedLabel,
        correctLabel:   d.correctLabel,
        confidence:     d.confidence,
        verified:       d.verified,
        createdAt,
      });
    });

    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err: any) {
    console.warn("[Feedback] Records fetch failed:", err?.message);
    return [];
  }
}

// ── localStorage offline helpers ──────────────────────────────────────────────

const LOCAL_FEEDBACK_KEY = "karnakavach_feedback_local";

function _saveLocalFeedback(input: SaveFeedbackInput): void {
  try {
    const existing: any[] = JSON.parse(localStorage.getItem(LOCAL_FEEDBACK_KEY) || "[]");
    // Deduplicate
    const alreadyExists = existing.some(
      (r) => r.userId === input.userId && r.scanId === input.scanId
    );
    if (alreadyExists) return;
    existing.push({ ...input, feedbackId: `local_${Date.now()}`, createdAt: new Date().toISOString() });
    localStorage.setItem(LOCAL_FEEDBACK_KEY, JSON.stringify(existing));
  } catch { /* ignore */ }
}

function _getLocalFeedbackStats(): FeedbackStats {
  try {
    const records: any[] = JSON.parse(localStorage.getItem(LOCAL_FEEDBACK_KEY) || "[]");
    const correct   = records.filter((r) => r.verified).length;
    const incorrect = records.filter((r) => !r.verified).length;
    const total     = correct + incorrect;
    return {
      total,
      correct,
      incorrect,
      estimatedAccuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  } catch {
    return { total: 0, correct: 0, incorrect: 0, estimatedAccuracy: 0 };
  }
}
