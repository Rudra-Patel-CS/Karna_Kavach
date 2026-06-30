"""
KarnaKavach — Dataset Builder
Reads feedback_dataset.csv + original dataset.csv,
validates, deduplicates, balances, and merges into a clean training CSV.

Outputs:
  - merged_dataset.csv  (ready for training)
  - dataset_stats.json  (statistics for UI)

Usage:
  python karnakavach_backend/dataset_builder.py
  python karnakavach_backend/dataset_builder.py --feedback path/to/feedback.csv
"""

import os
import sys
import json
import re
import hashlib
from datetime import datetime, timezone

import pandas as pd

BACKEND_DIR   = os.path.dirname(os.path.abspath(__file__))
ORIGINAL_PATH = os.path.join(BACKEND_DIR, "dataset.csv")
FEEDBACK_PATH = os.path.join(BACKEND_DIR, "feedback_dataset.csv")
MERGED_PATH   = os.path.join(BACKEND_DIR, "merged_dataset.csv")
STATS_PATH    = os.path.join(BACKEND_DIR, "dataset_stats.json")

LABEL_MAP = {
    "Phishing":   1,
    "phishing":   1,
    "1":          1,
    1:            1,
    "Legitimate": 0,
    "legitimate": 0,
    "0":          0,
    0:            0,
    "Suspicious": 1,   # treat suspicious as phishing for binary classification
    "suspicious": 1,
}


def _clean_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.lower().strip()
    text = re.sub(r'<[^>]+>', ' ', text)          # strip HTML
    text = re.sub(r'http\S+', ' URL ', text)       # tokenize URLs
    text = re.sub(r'\S+@\S+', ' EMAIL ', text)     # tokenize emails
    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)   # remove special chars
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def _dedup_key(row: pd.Series) -> str:
    raw = (
        str(row.get("sender", "")).lower().strip() + "|" +
        str(row.get("subject", "")).lower().strip() + "|" +
        str(row.get("body", ""))[:200].lower().strip()
    )
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def validate_record(row: pd.Series) -> bool:
    """Return True if a record has the minimum required fields."""
    required = ["subject", "body"]
    for col in required:
        val = row.get(col, "")
        if not isinstance(val, str) or len(val.strip()) < 3:
            return False
    return True


def load_original() -> pd.DataFrame:
    if not os.path.exists(ORIGINAL_PATH):
        print(f"[Builder] Original dataset not found at {ORIGINAL_PATH}")
        return pd.DataFrame()
    df = pd.read_csv(ORIGINAL_PATH)
    if "label" not in df.columns:
        print("[Builder] Original dataset missing 'label' column — skipping.")
        return pd.DataFrame()
    if "sender" not in df.columns:
        df["sender"] = ""
    df["source"] = "original"
    return df[["sender", "subject", "body", "label", "source"]].copy()


def load_feedback(feedback_path: str = FEEDBACK_PATH) -> pd.DataFrame:
    if not os.path.exists(feedback_path):
        print(f"[Builder] Feedback dataset not found at {feedback_path}")
        return pd.DataFrame()

    df = pd.read_csv(feedback_path)

    # Map correctLabel string → integer label
    label_col = "correctLabel" if "correctLabel" in df.columns else "correct_label"
    if label_col not in df.columns:
        print("[Builder] Feedback CSV missing label column — skipping.")
        return pd.DataFrame()

    df["label"] = df[label_col].map(LABEL_MAP)
    df = df.dropna(subset=["label"])
    df["label"] = df["label"].astype(int)

    # Normalise column names
    for alias, target in [("sender","sender"),("subject","subject"),("body","body")]:
        if alias not in df.columns:
            df[alias] = ""

    df["source"] = "feedback"
    return df[["sender", "subject", "body", "label", "source"]].copy()


def build_dataset(feedback_path: str = FEEDBACK_PATH) -> dict:
    """
    Main pipeline: load → validate → deduplicate → balance → save.
    Returns statistics dict.
    """
    print("[Builder] Loading datasets...")
    orig_df = load_original()
    fb_df   = load_feedback(feedback_path)

    frames = [f for f in [orig_df, fb_df] if not f.empty]
    if not frames:
        return {"error": "No data available to build dataset."}

    combined = pd.concat(frames, ignore_index=True)
    combined.fillna("", inplace=True)
    total_raw = len(combined)

    # ── Validation ────────────────────────────────────────────────────────────
    valid_mask  = combined.apply(validate_record, axis=1)
    invalid_count = int((~valid_mask).sum())
    combined    = combined[valid_mask].copy()
    print(f"[Builder] Valid: {len(combined)} / Invalid: {invalid_count}")

    # ── Deduplication ─────────────────────────────────────────────────────────
    combined["_dedup"] = combined.apply(_dedup_key, axis=1)
    before_dedup = len(combined)
    # Keep latest occurrence (last row wins for same key)
    combined = combined.drop_duplicates(subset=["_dedup"], keep="last")
    dups_removed = before_dedup - len(combined)
    combined.drop(columns=["_dedup", "source"], inplace=True, errors="ignore")
    print(f"[Builder] Duplicates removed: {dups_removed}")

    # ── Label stats ───────────────────────────────────────────────────────────
    n_phishing  = int((combined["label"] == 1).sum())
    n_legit     = int((combined["label"] == 0).sum())
    total_clean = len(combined)

    # Class imbalance warning (>80% one class)
    imbalance_warn = False
    if total_clean > 0:
        max_ratio = max(n_phishing, n_legit) / total_clean
        imbalance_warn = max_ratio > 0.80

    # ── Quality score (0–100) ─────────────────────────────────────────────────
    q = 100
    if total_clean < 50:  q -= 30
    elif total_clean < 100: q -= 10
    if imbalance_warn:    q -= 20
    if invalid_count > total_raw * 0.2: q -= 10
    quality_score = max(0, q)

    # ── Save merged dataset ───────────────────────────────────────────────────
    combined.to_csv(MERGED_PATH, index=False, encoding="utf-8")
    print(f"[Builder] Merged dataset saved to {MERGED_PATH} ({total_clean} rows)")

    # ── Stats ─────────────────────────────────────────────────────────────────
    stats = {
        "total_raw":       total_raw,
        "valid":           total_clean,
        "invalid":         invalid_count,
        "dups_removed":    dups_removed,
        "n_phishing":      n_phishing,
        "n_legitimate":    n_legit,
        "n_suspicious":    0,   # merged into phishing for binary model
        "quality_score":   quality_score,
        "imbalance_warn":  imbalance_warn,
        "merged_path":     MERGED_PATH,
        "built_at":        datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
    }

    with open(STATS_PATH, "w") as f:
        json.dump(stats, f, indent=2)
    print(f"[Builder] Stats saved to {STATS_PATH}")

    return stats


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--feedback", default=FEEDBACK_PATH)
    args = parser.parse_args()
    result = build_dataset(args.feedback)
    print(json.dumps(result, indent=2))
