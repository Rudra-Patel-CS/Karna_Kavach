"""
KarnaKavach — Hybrid Analysis CLI
Reads JSON from stdin: {sender, subject, body}
Returns a unified hybrid analysis combining Rule Engine + ML Model.

Rule Engine weight:  25%
ML Model weight:     35%
(Gemini AI weight:   40% — applied server-side after this script returns)

Output JSON:
{
  ml_verdict, ml_confidence, ml_probability, ml_reasons,
  rule_score, rule_triggered, rule_threat_category,
  rule_urgency_score, rule_credential_request, rule_sender_mismatch,
  hybrid_score,   (rule 25% + ml 75% — AI adds its 40% weight in Node)
  url_analyses,
  email_intel: { sender_domain, is_trusted, has_suspicious_tld, url_count, urgency_score }
}
"""

import sys
import json
import os
import re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from inference.predict import predict_email
from feature_engineering.rule_engine import run_rule_engine
from feature_engineering.extractor import _extract_sender_domain, _is_trusted_domain, _has_suspicious_tld


def hybrid_analyze(sender: str, subject: str, body: str, reply_to: str = "", attachments: list = None) -> dict:
    # ── ML Analysis ───────────────────────────────────────────────────────────
    try:
        ml_result = predict_email(sender, subject, body)
    except RuntimeError as e:
        ml_result = {
            "prediction": "Unknown",
            "confidence_score": 0.5,
            "probability_phishing": 0.5,
            "probability_legitimate": 0.5,
            "explanation": str(e),
            "url_analysis": [],
            "reasons": [str(e)],
        }

    # ── Rule Engine ───────────────────────────────────────────────────────────
    attachments_list = attachments or []
    rule_result = run_rule_engine(sender, subject, body, reply_to=reply_to, attachments=attachments_list)

    # ── Hybrid Score (Rule 25% + ML 75%) ─────────────────────────────────────
    # Gemini AI adds 40% weight on the Node side, rescaling to full 100
    ml_score  = round(ml_result["probability_phishing"] * 100)
    rule_score = rule_result["rule_score"]
    hybrid_score = round(rule_score * 0.25 + ml_score * 0.75)

    # ── Email Intelligence ────────────────────────────────────────────────────
    domain = _extract_sender_domain(sender)
    
    # Parse sender name and email
    sender_name = ""
    sender_email = ""
    name_email_match = re.match(r"(.*?)\s*<([^>]+)>", sender)
    if name_email_match:
        sender_name = name_email_match.group(1).strip(' \'"')
        sender_email = name_email_match.group(2).strip()
    else:
        email_only_match = re.search(r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})", sender)
        if email_only_match:
            sender_email = email_only_match.group(1)
            sender_name = sender_email.split('@')[0]
        else:
            sender_name = sender.strip()
            sender_email = sender.strip()

    sender_trust = "Medium"
    if _is_trusted_domain(domain):
        sender_trust = "High"
    elif _has_suspicious_tld(domain) or rule_result["sender_mismatch"] or rule_result["brand_detected"]:
        sender_trust = "Low"

    # Subject/Body risk heuristic
    subj_risk = "Low"
    if rule_result["urgency_score"] >= 6 or rule_result["credential_request"]:
        subj_risk = "High"
    elif rule_result["urgency_score"] >= 2:
        subj_risk = "Medium"

    body_risk = "Low"
    high_risk_rules = {"IP_ADDRESS_URL", "HOMOGRAPH_DOMAIN", "BRAND_IMPERSONATION", "DANGEROUS_ATTACHMENT", "CREDENTIAL_HARVEST"}
    medium_risk_rules = {"HTTP_LINKS", "SHORTENED_URLS", "UNICODE_DOMAIN", "SUSPICIOUS_TLD", "CREDENTIAL_MENTION", "URGENCY_LANGUAGE", "LOTTERY_SCAM", "REPLY_TO_MISMATCH", "FAKE_SYSTEM_SENDER", "FAKE_PAYMENT", "ARCHIVE_ATTACHMENT", "SUSPICIOUS_DOCUMENT_ATTACHMENT"}
    
    triggered_names = {r["rule"] for r in rule_result["triggered_rules"]}
    if triggered_names.intersection(high_risk_rules):
        body_risk = "High"
    elif triggered_names.intersection(medium_risk_rules):
        body_risk = "Medium"

    email_intel = {
        "sender_name":         sender_name,
        "sender_email":        sender_email,
        "sender_domain":       domain,
        "reply_to":            reply_to,
        "subject":             subject,
        "body":                body,
        "email_length":        len(subject or "") + len(body or ""),
        "url_count":           rule_result["url_count"],
        "suspicious_keyword_count": rule_result["suspicious_keyword_count"],
        "urgency_score":       rule_result["urgency_score"],
        "brand_detected":      rule_result["brand_detected"],
        "is_trusted":          _is_trusted_domain(domain),
        "has_suspicious_tld":  _has_suspicious_tld(domain),
        "credential_request":  rule_result["credential_request"],
        "sender_mismatch":     rule_result["sender_mismatch"],
        "threat_category":     rule_result["threat_category"],
        "attachments":         attachments_list,
        "sender_trust":        sender_trust,
        "subject_risk":        subj_risk,
        "body_risk":           body_risk,
    }

    return {
        # ML results
        "ml_verdict":          ml_result["prediction"],
        "ml_confidence":       round(ml_result["confidence_score"] * 100),
        "ml_probability":      round(ml_result["probability_phishing"] * 100),
        "ml_reasons":          ml_result["reasons"],
        # Rule engine results
        "rule_score":          rule_score,
        "rule_triggered":      rule_result["triggered_rules"],
        "rule_threat_category": rule_result["threat_category"],
        "rule_urgency_score":  rule_result["urgency_score"],
        "rule_credential_request": rule_result["credential_request"],
        "rule_sender_mismatch": rule_result["sender_mismatch"],
        # Combined
        "hybrid_score":        hybrid_score,
        "url_analyses":        rule_result["urls_analyzed"],
        "email_intel":         email_intel,
    }


if __name__ == "__main__":
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            print(json.dumps({"error": "No input provided"}))
            sys.exit(1)
        data = json.loads(raw)
        result = hybrid_analyze(
            data.get("sender", ""),
            data.get("subject", ""),
            data.get("body", ""),
            reply_to=data.get("reply_to", ""),
            attachments=data.get("attachments", []),
        )
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
