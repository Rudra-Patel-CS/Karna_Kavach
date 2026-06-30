"""
KarnaKavach — Metrics Reader
Returns current metrics.json content as JSON to stdout.
Also returns dataset_stats.json if available.

Usage:
  python karnakavach_backend/metrics.py
"""
import os
import sys
import json

BACKEND_DIR  = os.path.dirname(os.path.abspath(__file__))
METRICS_PATH = os.path.join(BACKEND_DIR, "models", "metrics.json")
STATS_PATH   = os.path.join(BACKEND_DIR, "dataset_stats.json")


def read_metrics() -> dict:
    result: dict = {}

    if os.path.exists(METRICS_PATH):
        try:
            with open(METRICS_PATH) as f:
                data = json.load(f)
            result["metrics"] = data.get("current", data)
            result["history"] = data.get("history", [])
        except Exception as e:
            result["metrics_error"] = str(e)

    if os.path.exists(STATS_PATH):
        try:
            with open(STATS_PATH) as f:
                result["dataset_stats"] = json.load(f)
        except Exception:
            pass

    return result


if __name__ == "__main__":
    print(json.dumps(read_metrics()))
