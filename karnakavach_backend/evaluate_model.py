"""
KarnaKavach ML Model Accuracy Evaluator
========================================
Run this script to check how accurate the trained model is.

Usage:
    python karnakavach_backend/evaluate_model.py
    python karnakavach_backend/evaluate_model.py --dataset karnakavach_backend/dataset.csv
    python karnakavach_backend/evaluate_model.py --test-emails   # runs 5 built-in test cases
"""

import sys
import os
import argparse
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from inference.predict import predict_email

# ─────────────────────────────────────────────
# Built-in test cases with known expected labels
# ─────────────────────────────────────────────
TEST_CASES = [
    {
        "label": "LEGITIMATE",
        "sender": "no-reply@classroom.google.com",
        "subject": "New announcement from your class",
        "body": "Your teacher posted a new announcement in Google Classroom. Log in to view it.",
        "expected": "Legitimate"
    },
    {
        "label": "LEGITIMATE",
        "sender": "DR. HIREN PATEL (Classroom) <no-reply@classroom.google.com>",
        "subject": "New announcement: Dear Student Four weeks from now",
        "body": (
            "Charotar Institute of Languages, Arts and Social Studies is offering four short, "
            "focused certificate courses this summer. Course Fee: 1000 per course. "
            "For registration, visit this link: https://forms.gle/URWUstqJJQFD9tRf7 "
            "Warm regards, Team CLASS Faculty of Humanities, CHARUSAT"
        ),
        "expected": "Legitimate"
    },
    {
        "label": "PHISHING",
        "sender": "support@paypal-secure-update.com",
        "subject": "Urgent: Verify your account NOW",
        "body": "Your PayPal account has been locked. Click here immediately to verify your identity or it will be permanently suspended.",
        "expected": "Phishing"
    },
    {
        "label": "PHISHING",
        "sender": "prize@lottery-winner-2025.com",
        "subject": "You have won $1,000,000!",
        "body": "Congratulations! You have been selected as the winner of our international lottery. Claim your prize now by providing your bank details.",
        "expected": "Phishing"
    },
    {
        "label": "LEGITIMATE",
        "sender": "hr@charusat.ac.in",
        "subject": "Holiday list for 2025",
        "body": "Please find attached the official holiday calendar for the year 2025 from the HR department.",
        "expected": "Legitimate"
    },
    {
        "label": "PHISHING",
        "sender": "admin@apple-id-locked.com",
        "subject": "Apple ID suspended",
        "body": "Your Apple ID has been disabled due to suspicious activity. Verify immediately to restore access.",
        "expected": "Phishing"
    },
    {
        "label": "LEGITIMATE",
        "sender": "no-reply@github.com",
        "subject": "Your repository was starred",
        "body": "Someone starred your repository on GitHub. Check it out.",
        "expected": "Legitimate"
    },
    {
        "label": "PHISHING",
        "sender": "scholarship@free-grant-claim.net",
        "subject": "You qualify for a scholarship grant",
        "body": "Congratulations! You have been selected for a scholarship of 50000. Claim now by providing your bank details immediately.",
        "expected": "Phishing"
    },
    {
        "label": "LEGITIMATE",
        "sender": "alerts@nptel.ac.in",
        "subject": "NPTEL course enrollment open",
        "body": "Enrollment for the new semester of NPTEL online courses is now open. Register before the deadline.",
        "expected": "Legitimate"
    },
    {
        "label": "PHISHING",
        "sender": "verify@account-confirm-secure.net",
        "subject": "Confirm your account now",
        "body": "Your account will be deactivated in 24 hours unless you confirm your details. Click here to verify now.",
        "expected": "Phishing"
    },
]


def run_test_cases():
    """Run all built-in test cases and show pass/fail with confidence."""
    print("\n" + "=" * 65)
    print("   KARNAKAVACH ML MODEL — BUILT-IN TEST EVALUATION")
    print("=" * 65)

    passed = 0
    failed = 0
    results = []

    for i, tc in enumerate(TEST_CASES, 1):
        result = predict_email(tc["sender"], tc["subject"], tc["body"])
        predicted = result["prediction"]
        confidence = round(result["confidence_score"] * 100, 1)
        correct = predicted == tc["expected"]

        status = "✅ PASS" if correct else "❌ FAIL"
        if correct:
            passed += 1
        else:
            failed += 1

        print(f"\n[{i:02d}] {status} | Expected: {tc['expected']:12s} | Got: {predicted:12s} | Confidence: {confidence}%")
        print(f"      Label : {tc['label']}")
        print(f"      Sender: {tc['sender'][:60]}")
        print(f"      Reason: {result['explanation'][:100]}")
        results.append({"test": i, "pass": correct, "expected": tc["expected"], "predicted": predicted, "confidence": confidence})

    total = passed + failed
    accuracy = round((passed / total) * 100, 1)

    print("\n" + "=" * 65)
    print(f"   RESULTS: {passed}/{total} passed  |  Accuracy: {accuracy}%")
    if accuracy >= 90:
        print("   🟢 Model performance: EXCELLENT")
    elif accuracy >= 75:
        print("   🟡 Model performance: GOOD — consider more training data")
    else:
        print("   🔴 Model performance: NEEDS IMPROVEMENT — retrain with more data")
    print("=" * 65 + "\n")


def run_csv_evaluation(csv_path: str):
    """Evaluate model against a labelled CSV file."""
    import pandas as pd
    from sklearn.metrics import (
        accuracy_score, precision_score, recall_score,
        f1_score, roc_auc_score, confusion_matrix, classification_report
    )

    print(f"\nLoading dataset: {csv_path}")
    df = pd.read_csv(csv_path)

    required = ["subject", "body", "label"]
    for col in required:
        if col not in df.columns:
            print(f"ERROR: Missing column '{col}' in CSV.")
            return

    if "sender" not in df.columns:
        df["sender"] = ""

    df.fillna("", inplace=True)

    print(f"Evaluating {len(df)} samples...\n")

    y_true = []
    y_pred = []
    y_prob = []

    for _, row in df.iterrows():
        result = predict_email(row["sender"], row["subject"], row["body"])
        pred_label = 1 if result["prediction"] == "Phishing" else 0
        y_true.append(int(row["label"]))
        y_pred.append(pred_label)
        y_prob.append(result["probability_phishing"])

    acc   = accuracy_score(y_true, y_pred)
    prec  = precision_score(y_true, y_pred, zero_division=0)
    rec   = recall_score(y_true, y_pred, zero_division=0)
    f1    = f1_score(y_true, y_pred, zero_division=0)
    auc   = roc_auc_score(y_true, y_prob)
    cm    = confusion_matrix(y_true, y_pred)

    print("=" * 65)
    print("   KARNAKAVACH ML MODEL — CSV EVALUATION REPORT")
    print("=" * 65)
    print(f"  Total Samples : {len(df)}")
    print(f"  Accuracy      : {acc:.4f}  ({round(acc*100, 2)}%)")
    print(f"  Precision     : {prec:.4f}  (of emails flagged as phishing, how many were real)")
    print(f"  Recall        : {rec:.4f}  (of real phishing, how many did we catch)")
    print(f"  F1-Score      : {f1:.4f}  (balance of precision and recall)")
    print(f"  ROC-AUC       : {auc:.4f}  (1.0 = perfect, 0.5 = random guess)")
    print(f"\n  Confusion Matrix:")
    print(f"                   Predicted Legit  Predicted Phish")
    print(f"  Actual Legit  :       {cm[0][0]:5d}           {cm[0][1]:5d}")
    print(f"  Actual Phish  :       {cm[1][0]:5d}           {cm[1][1]:5d}")
    print(f"\n  False Positives (legit flagged as phish): {cm[0][1]}")
    print(f"  False Negatives (phish missed by model) : {cm[1][0]}")
    print("\n" + classification_report(y_true, y_pred, target_names=["Legitimate", "Phishing"]))
    print("=" * 65 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate KarnaKavach ML model accuracy")
    parser.add_argument("--dataset", type=str, default=None, help="Path to labelled CSV for evaluation")
    parser.add_argument("--test-emails", action="store_true", help="Run built-in test cases")
    args = parser.parse_args()

    if args.dataset:
        run_csv_evaluation(args.dataset)
    else:
        # Default: run built-in test cases
        run_test_cases()
        if not args.test_emails:
            print("Tip: Run with --dataset karnakavach_backend/dataset.csv for full CSV metrics.\n")
