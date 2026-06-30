"""
KarnaKavach — Retrain Pipeline
Full pipeline: build dataset → train → evaluate → backup & save → emit metrics.

Streams progress lines to stdout for real-time SSE support.
Final line is always a JSON object.

Usage:
  python karnakavach_backend/retrain.py
  python karnakavach_backend/retrain.py --feedback path/to/feedback.csv
"""

import os
import sys
import json
import shutil
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix,
)
from datetime import datetime, timezone
from models.classifier import get_vectorizer, get_model, MODEL_PATH, VECTORIZER_PATH
from feature_engineering.extractor import extract_features
from dataset_builder import build_dataset, MERGED_PATH
import joblib

BACKEND_DIR   = os.path.dirname(os.path.abspath(__file__))
METRICS_PATH  = os.path.join(BACKEND_DIR, "models", "metrics.json")
BACKUP_MODEL  = os.path.join(BACKEND_DIR, "models", "phishing_model_backup.pkl")
BACKUP_VEC    = os.path.join(BACKEND_DIR, "models", "tfidf_vectorizer_backup.pkl")


def log(msg: str):
    print(msg, flush=True)


def _backup_existing():
    """Copy current model artifacts to backup before overwriting."""
    if os.path.exists(MODEL_PATH):
        shutil.copy2(MODEL_PATH, BACKUP_MODEL)
        log("[BACKUP] Existing model backed up.")
    if os.path.exists(VECTORIZER_PATH):
        shutil.copy2(VECTORIZER_PATH, BACKUP_VEC)
        log("[BACKUP] Existing vectorizer backed up.")


def _restore_backup():
    """Restore backup if training failed."""
    restored = False
    if os.path.exists(BACKUP_MODEL):
        shutil.copy2(BACKUP_MODEL, MODEL_PATH)
        restored = True
    if os.path.exists(BACKUP_VEC):
        shutil.copy2(BACKUP_VEC, VECTORIZER_PATH)
        restored = True
    if restored:
        log("[RESTORE] Previous model restored from backup.")


def retrain(feedback_path: str = None) -> dict:
    start_time = time.time()
    log("[START] KarnaKavach Retraining Pipeline")

    # ── Step 1: Build merged dataset ──────────────────────────────────────────
    log("[STEP 1] Building merged dataset...")
    build_kwargs = {} if not feedback_path else {"feedback_path": feedback_path}
    stats = build_dataset(**(build_kwargs))
    if "error" in stats:
        raise RuntimeError(stats["error"])

    log(f"[DATA] {stats['valid']} valid samples "
        f"({stats['n_legitimate']} legitimate, {stats['n_phishing']} phishing) "
        f"| {stats['dups_removed']} duplicates removed")

    # ── Step 2: Load merged dataset ────────────────────────────────────────────
    df = pd.read_csv(MERGED_PATH)
    df.fillna("", inplace=True)

    if len(df) < 10:
        raise RuntimeError(f"Insufficient data ({len(df)} rows). Need at least 10 samples.")

    # ── Step 3: Feature extraction ─────────────────────────────────────────────
    log("[STEP 2] Extracting features...")
    df["combined_text"] = df.apply(
        lambda r: extract_features(r["sender"], r["subject"], r["body"]), axis=1
    )

    X = df["combined_text"]
    y = df["label"]

    # ── Step 4: Train/test split ───────────────────────────────────────────────
    test_size = 0.2 if len(df) >= 20 else 0.1
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y
    )
    log(f"[SPLIT] Train: {len(X_train)} | Test: {len(X_test)}")

    # ── Step 5: Vectorize ──────────────────────────────────────────────────────
    log("[STEP 3] Fitting TF-IDF vectorizer...")
    vectorizer = get_vectorizer()
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec  = vectorizer.transform(X_test)

    # ── Step 6: Train ──────────────────────────────────────────────────────────
    log("[STEP 4] Training Logistic Regression...")
    _backup_existing()
    model = get_model()
    model.fit(X_train_vec, y_train)

    # ── Step 7: Evaluate ───────────────────────────────────────────────────────
    log("[STEP 5] Evaluating model...")
    y_pred = model.predict(X_test_vec)
    y_prob = model.predict_proba(X_test_vec)[:, 1]

    acc  = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec  = float(recall_score(y_test, y_pred, zero_division=0))
    f1   = float(f1_score(y_test, y_pred, zero_division=0))
    auc  = float(roc_auc_score(y_test, y_prob)) if len(set(y_test)) > 1 else 0.0
    cm   = confusion_matrix(y_test, y_pred).tolist()

    log(f"[METRICS] Accuracy={acc:.4f} Precision={prec:.4f} "
        f"Recall={rec:.4f} F1={f1:.4f} AUC={auc:.4f}")

    # ── Step 8: Save artifacts ─────────────────────────────────────────────────
    log("[STEP 6] Saving model artifacts...")
    joblib.dump(vectorizer, VECTORIZER_PATH)
    joblib.dump(model, MODEL_PATH)
    log("[SAVE] Model and vectorizer saved.")

    # ── Step 9: Save metrics.json ──────────────────────────────────────────────
    duration_ms = int((time.time() - start_time) * 1000)
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    # Load old metrics to track improvement
    old_accuracy = None
    if os.path.exists(METRICS_PATH):
        try:
            with open(METRICS_PATH) as mf:
                old = json.load(mf)
            old_accuracy = old.get("current", old).get("accuracy")
        except Exception:
            pass

    metrics = {
        "version":          1,
        "training_date":    now,
        "dataset_size":     len(df),
        "n_legitimate":     int(stats["n_legitimate"]),
        "n_phishing":       int(stats["n_phishing"]),
        "train_samples":    len(X_train),
        "test_samples":     len(X_test),
        "accuracy":         round(acc,  4),
        "precision":        round(prec, 4),
        "recall":           round(rec,  4),
        "f1_score":         round(f1,   4),
        "roc_auc":          round(auc,  4),
        "confusion_matrix": cm,
        "training_duration_ms": duration_ms,
        "old_accuracy":     old_accuracy,
        "accuracy_improvement": round(acc - old_accuracy, 4) if old_accuracy is not None else None,
    }

    full_metrics = {"current": metrics}
    if os.path.exists(METRICS_PATH):
        try:
            with open(METRICS_PATH) as mf:
                existing = json.load(mf)
            history = existing.get("history", [])
            if "current" in existing:
                history.append(existing["current"])
            full_metrics["history"] = history
        except Exception:
            full_metrics["history"] = []
    else:
        full_metrics["history"] = []

    os.makedirs(os.path.dirname(METRICS_PATH), exist_ok=True)
    with open(METRICS_PATH, "w") as mf:
        json.dump(full_metrics, mf, indent=2)
    log(f"[SAVE] metrics.json updated.")

    log(f"[DONE] Retraining complete in {duration_ms / 1000:.1f}s. "
        f"Accuracy: {acc:.4f}")

    # Final JSON result line (parsed by Node SSE handler)
    print(json.dumps({"success": True, "metrics": metrics}), flush=True)
    return metrics


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--feedback", default=None)
    args = parser.parse_args()

    try:
        retrain(feedback_path=args.feedback)
    except Exception as e:
        log(f"[ERROR] {e}")
        _restore_backup()
        print(json.dumps({"success": False, "error": str(e)}), flush=True)
        sys.exit(1)
