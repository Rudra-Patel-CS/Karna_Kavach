"""
KarnaKavach Retrain CLI
Merges original dataset + feedback dataset, retrains model with versioning, saves metrics.json
Streams progress lines to stdout for real-time UI updates.
"""
import sys
import os
import json
import re
import hashlib
import shutil
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix
)
from models.classifier import get_vectorizer, get_model
from feature_engineering.extractor import extract_features
import joblib

BACKEND_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR    = os.path.join(BACKEND_DIR, "models")
DATASET_PATH  = os.path.join(BACKEND_DIR, "dataset.csv")
FEEDBACK_PATH = os.path.join(BACKEND_DIR, "feedback_dataset.csv")
METRICS_PATH  = os.path.join(MODELS_DIR, "metrics.json")
VERSION_PATH  = os.path.join(MODELS_DIR, "version.json")


def log(msg: str):
    """Stream a progress line to stdout immediately."""
    print(msg, flush=True)


def get_next_version() -> int:
    if os.path.exists(VERSION_PATH):
        try:
            with open(VERSION_PATH) as f:
                data = json.load(f)
            return int(data.get("current_version", 1)) + 1
        except Exception:
            pass
    return 1


def load_and_merge() -> pd.DataFrame:
    frames = []

    # Load original dataset
    if os.path.exists(DATASET_PATH):
        df_orig = pd.read_csv(DATASET_PATH)
        log(f"[DATA] Original dataset: {len(df_orig)} rows")
        frames.append(df_orig)
    else:
        log("[WARN] Original dataset not found — training only on feedback.")

    # Load feedback dataset — use correct_label as the ground truth label
    if os.path.exists(FEEDBACK_PATH):
        df_fb = pd.read_csv(FEEDBACK_PATH)
        log(f"[DATA] Feedback dataset: {len(df_fb)} rows")
        # Map correct_label string → integer
        df_fb["label"] = df_fb["correct_label"].map({"Phishing": 1, "Legitimate": 0})
        # Keep only the columns we need
        df_fb = df_fb[["sender", "subject", "body", "label"]].copy()
        frames.append(df_fb)

    if not frames:
        raise RuntimeError("No data found. Cannot retrain.")

    merged = pd.concat(frames, ignore_index=True)

    # Fill missing columns
    if "sender" not in merged.columns:
        merged["sender"] = ""
    merged.fillna("", inplace=True)

    # Deduplicate on (sender, subject, body)
    before = len(merged)
    merged["_dedup_key"] = (
        merged["sender"].str.lower().str.strip() + "|" +
        merged["subject"].str.lower().str.strip() + "|" +
        merged["body"].str[:200].str.lower().str.strip()
    )
    merged = merged.drop_duplicates(subset=["_dedup_key"]).drop(columns=["_dedup_key"])
    after = len(merged)
    if before != after:
        log(f"[DATA] Removed {before - after} duplicate rows → {after} unique samples")

    # Validate labels
    merged["label"] = pd.to_numeric(merged["label"], errors="coerce")
    merged = merged[merged["label"].isin([0, 1])].copy()
    merged["label"] = merged["label"].astype(int)

    return merged


def balance_classes(df: pd.DataFrame) -> pd.DataFrame:
    """Upsample minority class to maintain balance (max 3:1 ratio)."""
    counts = df["label"].value_counts()
    if len(counts) < 2:
        return df
    majority_count = counts.max()
    minority_count = counts.min()
    ratio = majority_count / minority_count
    if ratio <= 3.0:
        return df  # Already balanced enough
    # Upsample minority
    minority_label = counts.idxmin()
    minority_df = df[df["label"] == minority_label]
    target_count = min(majority_count, minority_count * 3)
    upsampled = minority_df.sample(n=int(target_count), replace=True, random_state=42)
    majority_df = df[df["label"] != minority_label]
    balanced = pd.concat([majority_df, upsampled], ignore_index=True).sample(frac=1, random_state=42)
    log(f"[DATA] Class balancing: {counts.to_dict()} → balanced to avoid >{ratio:.1f}:1 ratio")
    return balanced


def retrain():
    version = get_next_version()
    log(f"[START] KarnaKavach model retraining — version v{version}")

    # Load & merge data
    df = load_and_merge()
    df = balance_classes(df)

    n_legit = int((df["label"] == 0).sum())
    n_phish = int((df["label"] == 1).sum())
    log(f"[DATA] Final training set: {len(df)} samples ({n_legit} legitimate, {n_phish} phishing)")

    if len(df) < 10:
        raise RuntimeError("Insufficient data for retraining. Need at least 10 samples.")

    # Feature extraction
    log("[FEATURES] Extracting features...")
    df["combined_text"] = df.apply(
        lambda row: extract_features(row["sender"], row["subject"], row["body"]), axis=1
    )

    X = df["combined_text"]
    y = df["label"]

    # Split
    test_size = 0.2 if len(df) >= 20 else 0.1
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y
    )
    log(f"[SPLIT] Train: {len(X_train)}, Test: {len(X_test)}")

    # Vectorize
    log("[VECTORIZE] Fitting TF-IDF vectorizer...")
    vectorizer = get_vectorizer()
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec  = vectorizer.transform(X_test)

    # Train
    log("[TRAIN] Training Logistic Regression...")
    model = get_model()
    model.fit(X_train_vec, y_train)

    # Evaluate
    log("[EVAL] Evaluating model...")
    y_pred = model.predict(X_test_vec)
    y_prob = model.predict_proba(X_test_vec)[:, 1]

    acc  = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec  = float(recall_score(y_test, y_pred, zero_division=0))
    f1   = float(f1_score(y_test, y_pred, zero_division=0))
    auc  = float(roc_auc_score(y_test, y_prob)) if len(set(y_test)) > 1 else 0.0
    cm   = confusion_matrix(y_test, y_pred).tolist()

    log(f"[METRICS] Accuracy={acc:.4f} Precision={prec:.4f} Recall={rec:.4f} F1={f1:.4f} AUC={auc:.4f}")

    # Save versioned artifacts
    vec_path   = os.path.join(MODELS_DIR, f"tfidf_vectorizer_v{version}.pkl")
    model_path = os.path.join(MODELS_DIR, f"phishing_model_v{version}.pkl")
    joblib.dump(vectorizer, vec_path)
    joblib.dump(model, model_path)
    log(f"[SAVE] Versioned artifacts: phishing_model_v{version}.pkl, tfidf_vectorizer_v{version}.pkl")

    # Overwrite active artifacts (used by predict.py)
    joblib.dump(vectorizer, os.path.join(MODELS_DIR, "tfidf_vectorizer.pkl"))
    joblib.dump(model, os.path.join(MODELS_DIR, "phishing_model.pkl"))
    log("[SAVE] Active model artifacts updated.")

    # Save metrics.json
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    metrics = {
        "version": version,
        "training_date": now,
        "dataset_size": len(df),
        "n_legitimate": n_legit,
        "n_phishing": n_phish,
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "roc_auc": round(auc, 4),
        "confusion_matrix": cm,
    }

    # Load history and append
    history = []
    if os.path.exists(METRICS_PATH):
        try:
            with open(METRICS_PATH) as f:
                existing = json.load(f)
            history = existing.get("history", [existing] if "version" in existing else [])
        except Exception:
            pass
    history.append(metrics)

    full_metrics = {"current": metrics, "history": history}
    with open(METRICS_PATH, "w") as f:
        json.dump(full_metrics, f, indent=2)
    log(f"[SAVE] metrics.json updated.")

    # Update version.json
    with open(VERSION_PATH, "w") as f:
        json.dump({"current_version": version, "updated_at": now}, f, indent=2)

    log(f"[DONE] Retraining complete! Active model is now v{version}.")
    print(json.dumps({"success": True, "metrics": metrics}), flush=True)


if __name__ == "__main__":
    try:
        retrain()
    except Exception as e:
        log(f"[ERROR] {e}")
        print(json.dumps({"success": False, "error": str(e)}), flush=True)
        sys.exit(1)
