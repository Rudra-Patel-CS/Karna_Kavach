/**
 * KarnaKavach — Model Version Service
 *
 * Manages model version records in Firestore: ml_models/{docId}
 *
 * Functions:
 *   saveModelVersion(version)   – create a new version record after retraining
 *   getModelVersions()          – list all versions sorted by date
 *   getActiveModelVersion()     – get the currently active version
 *   setActiveVersion(docId)     – mark a specific version as active
 */

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, isDummy } from "../firebase";
import type { ModelVersion } from "../types";

const COLLECTION = "ml_models";

// ── Save a new version record ─────────────────────────────────────────────────

export async function saveModelVersion(
  metrics: any,
  feedbackCount: number
): Promise<string | null> {
  if (isDummy || !db) {
    console.log("[ModelVersion] Offline — version not saved to Firestore.");
    return null;
  }

  try {
    // Mark all existing versions as inactive before adding new active one
    await _deactivateAllVersions();

    const docRef = await addDoc(collection(db, COLLECTION), {
      version:             `v${metrics.version ?? 1}.0.0`,
      modelType:           "TF-IDF + Logistic Regression",
      accuracy:            metrics.accuracy ?? 0,
      precision:           metrics.precision ?? 0,
      recall:              metrics.recall ?? 0,
      f1Score:             metrics.f1_score ?? 0,
      rocAuc:              metrics.roc_auc ?? 0,
      datasetSize:         metrics.dataset_size ?? 0,
      feedbackCount,
      nLegitimate:         metrics.n_legitimate ?? 0,
      nPhishing:           metrics.n_phishing ?? 0,
      confusionMatrix:     metrics.confusion_matrix ?? [],
      trainedAt:           serverTimestamp(),
      active:              true,
      trainingDurationMs:  null,
    });

    console.log("[ModelVersion] ✅ Version saved:", docRef.id);
    return docRef.id;
  } catch (err: any) {
    console.error("[ModelVersion] Failed to save version:", err?.message);
    return null;
  }
}

// ── Get all versions ──────────────────────────────────────────────────────────

export async function getModelVersions(): Promise<ModelVersion[]> {
  if (isDummy || !db) return _getLocalVersions();

  try {
    const q = query(collection(db, COLLECTION), orderBy("trainedAt", "desc"));
    const snap = await getDocs(q);
    const versions: ModelVersion[] = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      let trainedAt = new Date().toISOString();
      if (d.trainedAt instanceof Timestamp) {
        trainedAt = d.trainedAt.toDate().toISOString();
      }
      versions.push({
        id:                  docSnap.id,
        version:             d.version ?? "v1.0.0",
        modelType:           d.modelType ?? "TF-IDF + Logistic Regression",
        accuracy:            d.accuracy ?? 0,
        precision:           d.precision ?? 0,
        recall:              d.recall ?? 0,
        f1Score:             d.f1Score ?? 0,
        rocAuc:              d.rocAuc ?? 0,
        datasetSize:         d.datasetSize ?? 0,
        feedbackCount:       d.feedbackCount ?? 0,
        nLegitimate:         d.nLegitimate ?? 0,
        nPhishing:           d.nPhishing ?? 0,
        confusionMatrix:     d.confusionMatrix ?? [],
        trainedAt,
        active:              d.active ?? false,
        trainingDurationMs:  d.trainingDurationMs ?? null,
      });
    });

    return versions;
  } catch (err: any) {
    console.warn("[ModelVersion] Fetch failed:", err?.message);
    return [];
  }
}

// ── Get active version ────────────────────────────────────────────────────────

export async function getActiveModelVersion(): Promise<ModelVersion | null> {
  const all = await getModelVersions();
  return all.find((v) => v.active) ?? all[0] ?? null;
}

// ── Set active version ────────────────────────────────────────────────────────

export async function setActiveVersion(docId: string): Promise<void> {
  if (isDummy || !db) return;
  try {
    await _deactivateAllVersions();
    await updateDoc(doc(db, COLLECTION, docId), { active: true });
  } catch (err: any) {
    console.error("[ModelVersion] setActiveVersion failed:", err?.message);
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _deactivateAllVersions(): Promise<void> {
  try {
    const q = query(collection(db, COLLECTION), where("active", "==", true));
    const snap = await getDocs(q);
    const updates = snap.docs.map((d) => updateDoc(d.ref, { active: false }));
    await Promise.all(updates);
  } catch { /* non-critical */ }
}

function _getLocalVersions(): ModelVersion[] {
  // Stub for offline mode — return empty list
  return [];
}
