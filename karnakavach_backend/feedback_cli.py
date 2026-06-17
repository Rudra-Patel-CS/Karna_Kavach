"""
KarnaKavach Feedback CLI
Receives feedback JSON via stdin, validates, deduplicates, and appends to feedback_dataset.csv
"""
import sys
import json
import os
import csv
import re
import hashlib
from datetime import datetime, timezone

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
FEEDBACK_PATH = os.path.join(BACKEND_DIR, "feedback_dataset.csv")

FIELDNAMES = [
    "id", "sender", "subject", "body", "urls",
    "predicted_label", "correct_label", "confidence",
    "label_verified", "timestamp", "source"
]

MAX_FIELD_LEN = {"sender": 256, "subject": 512, "body": 65536, "urls": 2048}


def sanitize(value: str, max_len: int = 1024) -> str:
    """Remove control characters and truncate."""
    if not isinstance(value, str):
        value = str(value)
    # Strip null bytes and control chars
    value = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', value)
    return value[:max_len]


def make_id(sender: str, subject: str, body: str) -> str:
    """Deterministic ID for deduplication."""
    raw = f"{sender.lower().strip()}|{subject.lower().strip()}|{body[:200].lower().strip()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def load_existing_ids() -> set:
    if not os.path.exists(FEEDBACK_PATH):
        return set()
    ids = set()
    try:
        with open(FEEDBACK_PATH, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("id"):
                    ids.add(row["id"])
    except Exception:
        pass
    return ids


def validate_label(label: str) -> bool:
    return label in ("Phishing", "Legitimate")


def save_feedback(data: dict) -> dict:
    sender  = sanitize(data.get("sender", ""), MAX_FIELD_LEN["sender"])
    subject = sanitize(data.get("subject", ""), MAX_FIELD_LEN["subject"])
    body    = sanitize(data.get("body", ""), MAX_FIELD_LEN["body"])
    urls    = sanitize(str(data.get("urls", "")), MAX_FIELD_LEN["urls"])

    predicted_label = data.get("predicted_label", "")
    correct_label   = data.get("correct_label", predicted_label)  # thumbs-up: same as predicted
    confidence      = data.get("confidence", 0)
    label_verified  = data.get("label_verified", False)
    source          = sanitize(data.get("source", "user"), 64)

    # Quality checks
    if not subject and not body:
        return {"success": False, "error": "Empty email — feedback rejected."}
    if not validate_label(predicted_label):
        return {"success": False, "error": f"Invalid predicted_label: {predicted_label}"}
    if not validate_label(correct_label):
        return {"success": False, "error": f"Invalid correct_label: {correct_label}"}

    entry_id = make_id(sender, subject, body)
    existing = load_existing_ids()
    if entry_id in existing:
        return {"success": False, "error": "Duplicate feedback — already stored.", "duplicate": True}

    file_exists = os.path.exists(FEEDBACK_PATH)
    row = {
        "id": entry_id,
        "sender": sender,
        "subject": subject,
        "body": body,
        "urls": urls,
        "predicted_label": predicted_label,
        "correct_label": correct_label,
        "confidence": confidence,
        "label_verified": label_verified,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": source,
    }

    with open(FEEDBACK_PATH, "a", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)

    return {"success": True, "id": entry_id}


if __name__ == "__main__":
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            print(json.dumps({"success": False, "error": "No input provided"}))
            sys.exit(1)
        data = json.loads(raw)
        result = save_feedback(data)
        print(json.dumps(result))
        sys.exit(0 if result["success"] else 1)
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
