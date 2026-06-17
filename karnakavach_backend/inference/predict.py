import os
import sys
import re
import numpy as np

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.classifier import load_artifacts
from feature_engineering.extractor import (
    extract_features, _extract_sender_domain,
    _is_trusted_domain, _has_suspicious_tld,
    _domain_mismatch, _count_urgency_signals,
    TRUSTED_DOMAINS
)
from feature_engineering.url_analyzer import extract_urls, analyze_url

# Cache model and vectorizer at module level
_vectorizer = None
_model = None

# Decision threshold — higher means the model needs to be MORE sure before
# calling something phishing (reduces false positives on legitimate emails)
PHISHING_THRESHOLD = 0.60


def get_loaded_artifacts():
    global _vectorizer, _model
    if _vectorizer is None or _model is None:
        try:
            _vectorizer, _model = load_artifacts()
        except FileNotFoundError:
            raise RuntimeError("Model is not initialized. Please train the model first.")
    return _vectorizer, _model


def predict_email(sender: str, subject: str, body: str) -> dict:
    """
    Full ML prediction pipeline with structural + textual analysis.
    Returns a prediction dictionary with confidence and explanation.
    """
    vectorizer, model = get_loaded_artifacts()

    # Step 1: Extract structured features
    processed_text = extract_features(sender, subject, body)

    # Step 2: Vectorize and get raw model probabilities
    features = vectorizer.transform([processed_text])
    probabilities = model.predict_proba(features)[0]
    prob_legit = float(probabilities[0])
    prob_phish = float(probabilities[1])

    # Step 3: Domain trust override
    domain = _extract_sender_domain(sender)
    is_trusted = _is_trusted_domain(domain)
    is_suspicious_tld = _has_suspicious_tld(domain)
    has_mismatch = _domain_mismatch(sender, body)

    # If sender domain is fully trusted, cap phishing probability aggressively
    if is_trusted and not has_mismatch:
        prob_phish = min(prob_phish, 0.30)

    # If domain has suspicious TLD or brand impersonation, boost phishing probability
    if is_suspicious_tld:
        prob_phish = max(prob_phish, 0.65)
    if has_mismatch:
        prob_phish = max(prob_phish, 0.75)

    # Step 4: URL analysis — only adjust for truly dangerous URLs
    combined_text = f"{subject or ''} {body or ''}"
    urls = extract_urls(combined_text)
    url_analyses = [analyze_url(url) for url in urls]

    url_max_risk = max([u['risk_score'] for u in url_analyses]) if url_analyses else 0

    # Only boost on genuinely dangerous URLs (high risk), not just long ones
    # Also don't penalise known-safe domains like forms.gle
    has_safe_link = any(
        "forms.gle" in u['url'] or
        "google.com" in u['url'] or
        "classroom.google.com" in u['url']
        for u in url_analyses
    )
    if not has_safe_link:
        if url_max_risk >= 80:
            prob_phish = max(prob_phish, 0.85)
        elif url_max_risk >= 60:
            prob_phish = max(prob_phish, 0.65)

    prob_legit = 1.0 - prob_phish

    # Step 5: Final decision using calibrated threshold
    is_phishing = prob_phish >= PHISHING_THRESHOLD

    # Step 6: Build explanation from active features
    feature_names = vectorizer.get_feature_names_out()
    active_features = features.nonzero()[1]
    coef = model.coef_[0]

    influential_words = []
    if len(active_features) > 0:
        scored_features = [
            (feature_names[idx], float(coef[idx]))
            for idx in active_features
            if not feature_names[idx].isupper()  # skip our synthetic tokens
        ]
        if is_phishing:
            scored_features.sort(key=lambda x: x[1], reverse=True)
            influential_words = [
                w for w, s in scored_features[:5] if s > 0
            ]
        else:
            scored_features.sort(key=lambda x: x[1])
            influential_words = [
                w for w, s in scored_features[:5] if s < 0
            ]

    # Step 7: Build reasons list for UI display
    reasons = []

    if is_trusted and not has_mismatch:
        reasons.append(f"Sender domain '{domain}' is a verified trusted source.")
    if has_mismatch:
        reasons.append(f"Brand impersonation detected: sender claims to be a known brand but uses domain '{domain}'.")
    if is_suspicious_tld:
        reasons.append(f"Sender uses a suspicious domain TLD known for phishing.")
    if url_analyses:
        high_risk_urls = [u for u in url_analyses if u['risk_score'] >= 60]
        if high_risk_urls:
            reasons.append(f"High-risk URLs detected: {', '.join(u['url'] for u in high_risk_urls)}")
    if influential_words:
        direction = "phishing" if is_phishing else "legitimate"
        reasons.append(f"Key text signals pointing to {direction}: {', '.join(influential_words[:3])}.")

    explanation = f"Model classified this email as {'Phishing' if is_phishing else 'Legitimate'} with {round(max(prob_phish, prob_legit) * 100, 1)}% confidence."
    if reasons:
        explanation += " " + reasons[0]

    return {
        "prediction": "Phishing" if is_phishing else "Legitimate",
        "confidence_score": max(prob_phish, prob_legit),
        "probability_phishing": prob_phish,
        "probability_legitimate": prob_legit,
        "explanation": explanation,
        "url_analysis": url_analyses,
        "reasons": reasons,
    }
