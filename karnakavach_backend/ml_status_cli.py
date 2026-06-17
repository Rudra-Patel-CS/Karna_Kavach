"""
KarnaKavach ML Status CLI
Returns current model version, dataset sizes, feedback stats, and metrics as JSON.
"""
import sys
import os
import json
import csv
from datetime import datetime

BACKEND_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR    = os.path.join(BACKEND_DIR, "models")
DATASET_PATH  = os.path.join(BACKEND_DIR, "dataset.csv")
FEEDBACK_PATH = os.path.join(BACKEND_DIR, "feedback_dataset.csv")
METRICS_PATH  = os.path.join(MODELS_DIR, "metrics.json")
VERSION_PATH  = os.path.join(MODELS_DIR, "version.json")


def count_csv_rows(path: str) -> int:
    if not os.path.exists(path):
        return 0
    try:
        with open(path, "r", encoding="utf-8", newline="") as f:
            return max(0, sum(1 for _ in f) - 1)  # subtract header
    except Exception:
        return 0


def get_feedback_stats() -> dict:
    if not os.path.exists(FEEDBACK_PATH):
        return {"total": 0, "correct": 0, "corrections": 0, "phishing": 0, "legitimate": 0}
    try:
        total = 0
        correct = 0
        corrections = 0
        phishing = 0
        legitimate = 0
        with open(FEEDBACK_PATH, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                total += 1
                predicted = row.get("predicted_label", "")
                correct_label = row.get("correct_label", predicted)
                if predicted == correct_label:
                    correct += 1
                else:
                    corrections += 1
                if correct_label == "Phishing":
                    phishing += 1
                else:
                    legitimate += 1
        return {
            "total": total,
            "correct": correct,
            "corrections": corrections,
            "phishing": phishing,
            "legitimate": legitimate,
        }
    except Exception:
        return {"total": 0, "correct": 0, "corrections": 0, "phishing": 0, "legitimate": 0}


def get_status() -> dict:
    version = 1
    last_trained = None
    metrics = None

    if os.path.exists(VERSION_PATH):
        try:
            with open(VERSION_PATH) as f:
                vdata = json.load(f)
            version = vdata.get("current_version", 1)
            last_trained = vdata.get("updated_at")
        except Exception:
            pass

    if os.path.exists(METRICS_PATH):
        try:
            with open(METRICS_PATH) as f:
                mdata = json.load(f)
            metrics = mdata.get("current", mdata)
        except Exception:
            pass

    dataset_size  = count_csv_rows(DATASET_PATH)
    feedback_size = count_csv_rows(FEEDBACK_PATH)
    feedback_stats = get_feedback_stats()

    # Check for auto-retrain threshold from settings file
    settings_path = os.path.join(BACKEND_DIR, "..", "karnakavach_ml_settings.json")
    auto_retrain_threshold = None
    if os.path.exists(settings_path):
        try:
            with open(settings_path) as f:
                s = json.load(f)
            auto_retrain_threshold = s.get("autoRetrainThreshold")
        except Exception:
            pass

    # Check if auto-retrain should trigger
    should_auto_retrain = False
    if auto_retrain_threshold and feedback_stats["total"] >= auto_retrain_threshold:
        should_auto_retrain = True

    return {
        "version": version,
        "version_label": f"v{version}",
        "last_trained": last_trained,
        "dataset_size": dataset_size,
        "feedback_size": feedback_size,
        "feedback_stats": feedback_stats,
        "metrics": metrics,
        "should_auto_retrain": should_auto_retrain,
        "auto_retrain_threshold": auto_retrain_threshold,
    }


if __name__ == "__main__":
    try:
        status = get_status()
        print(json.dumps(status))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
